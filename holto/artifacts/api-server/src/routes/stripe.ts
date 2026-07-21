import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getUncachableStripeClient } from "../stripeClient";
import { stripeStorage } from "../stripeStorage";
import { stripeService } from "../stripeService";
import { getUserTier, PRODUCT_TO_TIER, inferTierFromProductName } from "../lib/tier";

const router: IRouter = Router();

router.get("/stripe/tier", requireAuth, async (req, res): Promise<void> => {
  try {
    const tier = await getUserTier(req.auth!.userId);
    res.json({ tier });
  } catch (err) {
    logger.error({ err }, "stripe/tier failed");
    res.json({ tier: "free" });
  }
});

router.get("/stripe/products", async (_req, res): Promise<void> => {
  try {
    const stripe = getUncachableStripeClient();

    const [productsRes, pricesRes] = await Promise.all([
      stripe.products.list({ active: true, limit: 100 }),
      stripe.prices.list({ active: true, limit: 100 }),
    ]);

    type ProductEntry = {
      id: string;
      name: string;
      description: string | null;
      tier: string;
      prices: Array<{
        id: string;
        unitAmount: number;
        currency: string;
        interval: string | null;
        intervalCount: number | null;
      }>;
    };

    const map = new Map<string, ProductEntry>();

    for (const product of productsRes.data) {
      map.set(product.id, {
        id: product.id,
        name: product.name,
        description: product.description ?? null,
        tier: PRODUCT_TO_TIER[product.id] ?? inferTierFromProductName(product.name),
        prices: [],
      });
    }

    for (const price of pricesRes.data) {
      const productId =
        typeof price.product === "string" ? price.product : (price.product as { id: string }).id;
      const entry = map.get(productId);
      if (entry && price.unit_amount != null) {
        entry.prices.push({
          id: price.id,
          unitAmount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval ?? null,
          intervalCount: price.recurring?.interval_count ?? null,
        });
      }
    }

    const products = Array.from(map.values()).filter((p) => p.prices.length > 0);
    res.json({ products });
  } catch (err) {
    logger.error({ err }, "stripe/products failed");
    res.status(502).json({ error: "Failed to fetch products" });
  }
});

router.post("/stripe/checkout", requireAuth, async (req, res): Promise<void> => {
  const { priceId } = req.body as { priceId?: string };

  if (!priceId) {
    res.status(400).json({ error: "priceId required" });
    return;
  }

  try {
    const user = await stripeStorage.getUser(req.auth!.userId);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(user.email, user.id);
      await stripeStorage.setStripeCustomerId(user.id, customer.id);
      customerId = customer.id;
    }

    const domains = process.env.REPLIT_DOMAINS?.split(",") ?? [];
    const baseUrl = domains[0] ? `https://${domains[0]}` : "https://www.holtotravel.co.uk";
    const successUrl = `${baseUrl}/api/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/api/stripe/checkout/cancel`;

    const stripeClient = getUncachableStripeClient();
    const priceObj = await stripeClient.prices.retrieve(priceId);
    const mode = priceObj.recurring ? "subscription" : "payment";

    const session = await stripeService.createCheckoutSession({
      customerId,
      priceId,
      mode,
      successUrl,
      cancelUrl,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "stripe/checkout failed");
    res.status(502).json({ error: "Failed to create checkout session" });
  }
});

router.post("/stripe/portal", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = await stripeStorage.getUser(req.auth!.userId);
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: "No Stripe customer found" });
      return;
    }

    const domains = process.env.REPLIT_DOMAINS?.split(",") ?? [];
    const returnUrl = domains[0] ? `https://${domains[0]}` : "https://www.holtotravel.co.uk";

    const session = await stripeService.createPortalSession(user.stripeCustomerId, returnUrl);
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "stripe/portal failed");
    res.status(502).json({ error: "Failed to create portal session" });
  }
});

router.get("/stripe/checkout/success", async (req, res): Promise<void> => {
  const sessionId = req.query.session_id as string | undefined;

  // Real order data for the affiliate (GoAffPro) conversion pixel, populated
  // only once we've confirmed the payment actually went through.
  let affiliateOrder: { number: string; total: number } | null = null;

  if (sessionId) {
    try {
      const stripeClient = getUncachableStripeClient();
      const session = await stripeClient.checkout.sessions.retrieve(sessionId, {
        expand: ["line_items.data.price.product"],
      });

      if (session.payment_status === "paid") {
        affiliateOrder = {
          number: session.id,
          total: (session.amount_total ?? 0) / 100,
        };
      }

      if (session.payment_status === "paid" && session.customer) {
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer.id;
        const user = await stripeStorage.getUserByStripeCustomerId(customerId);

        if (user) {
          for (const item of session.line_items?.data ?? []) {
            const product = item.price?.product;
            const productId =
              typeof product === "string"
                ? product
                : (product as { id: string } | null)?.id ?? "";
            const productName =
              typeof product === "object" && product !== null
                ? (product as { name: string }).name
                : "";

            const tier =
              PRODUCT_TO_TIER[productId] ?? inferTierFromProductName(productName);

            if (tier === "trip_pass") {
              const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
              await stripeStorage.setTripPassExpiry(user.id, expiresAt);
              logger.info({ userId: user.id, expiresAt }, "Trip Pass activated");
              break;
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Failed to process checkout success");
    }
  }

  // This "thank you" page is served by the API (not the web PWA), so it needs
  // its own copy of the GoAffPro loader plus a conversion pixel carrying the
  // real order number + total. Both are emitted only for a confirmed-paid
  // session; JSON.stringify safely escapes the values into the script.
  const affiliateHead = affiliateOrder
    ? `<script async src="https://api.goaffpro.com/loader.js?shop=tudjoystqf"></script>`
    : "";
  const affiliateBody = affiliateOrder
    ? `<script>(function(){window.goaffpro_order=${JSON.stringify(affiliateOrder)};function fire(){try{if(typeof goaffproTrackConversion==='function'){goaffproTrackConversion();return true}}catch(e){}return false}if(!fire()){var n=0,t=setInterval(function(){n++;if(fire()||n>40)clearInterval(t)},250)}})();</script>`
    : "";

  res.send(`<!DOCTYPE html><html><head><title>Payment successful — HOLTO</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
${affiliateHead}
<style>body{font-family:system-ui,sans-serif;background:#0a1628;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box;text-align:center}
.card{background:#162238;border-radius:16px;padding:40px 32px;max-width:400px;width:100%}
.icon{font-size:56px;margin-bottom:16px}h1{margin:0 0 8px;font-size:22px;color:#0d9488}p{color:#94a3b8;margin:0 0 24px;line-height:1.5}
.btn{display:inline-block;background:#0d9488;color:#fff;border:none;border-radius:10px;padding:14px 28px;font-size:16px;font-weight:600;cursor:pointer;text-decoration:none}</style></head>
<body><div class="card"><div class="icon">✅</div>
<h1>Payment successful!</h1>
<p>Your HOLTO plan is now active. Return to the app to start using your new features.</p>
<a class="btn" href="https://www.holtotravel.co.uk">Back to HOLTO</a></div>
${affiliateBody}
</body></html>`);
});

router.get("/stripe/checkout/cancel", (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Payment cancelled — HOLTO</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#0a1628;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box;text-align:center}
.card{background:#162238;border-radius:16px;padding:40px 32px;max-width:400px;width:100%}
.icon{font-size:56px;margin-bottom:16px}h1{margin:0 0 8px;font-size:22px}p{color:#94a3b8;margin:0 0 24px;line-height:1.5}
.btn{display:inline-block;background:#334155;color:#fff;border:none;border-radius:10px;padding:14px 28px;font-size:16px;font-weight:600;cursor:pointer;text-decoration:none}</style></head>
<body><div class="card"><div class="icon">↩️</div>
<h1>Payment cancelled</h1>
<p>No charge was made. Return to the HOLTO app whenever you're ready to upgrade.</p>
<a class="btn" href="https://www.holtotravel.co.uk">Back to HOLTO</a></div></body></html>`);
});

export default router;
