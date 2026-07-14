import { db, esimOrdersTable, usersTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { airaloConfigured, findPackage, getEsimPackages, placeOrder } from "../lib/airalo";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function appOrigin(): string {
  return (process.env.APP_ORIGIN ?? process.env.PUBLIC_URL ?? "https://app.holtotravel.com").replace(/\/+$/, "");
}

// Is the eSIM partner integration switched on (Airalo + Stripe both configured)?
router.get("/esim/status", requireAuth, (_req, res): void => {
  res.json({ configured: airaloConfigured(), canBuy: airaloConfigured() && !!process.env.STRIPE_SECRET_KEY });
});

// Data plans available for a destination (two-letter country code). Cached, and
// empty when Airalo isn't configured — the client simply hides the section.
router.get("/esim/packages", requireAuth, async (req, res): Promise<void> => {
  const country = String(req.query.country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    res.status(400).json({ error: "A two-letter country code is required." });
    return;
  }
  const packages = await getEsimPackages(country);
  res.set("cache-control", "private, max-age=1800");
  res.json({ configured: airaloConfigured(), canBuy: airaloConfigured() && !!process.env.STRIPE_SECRET_KEY, country, packages });
});

// Start a purchase: verify the package + price server-side, record a pending
// order, and hand back a Stripe Checkout URL. The eSIM is only ordered from
// Airalo AFTER Stripe confirms payment (see /esim/fulfill).
router.post("/esim/checkout", requireAuth, async (req, res): Promise<void> => {
  if (!airaloConfigured() || !process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "eSIM purchases aren't available yet." });
    return;
  }
  const { packageId, country } = req.body as { packageId?: string; country?: string };
  const code = String(country ?? "").trim().toUpperCase();
  if (!packageId || !/^[A-Z]{2}$/.test(code)) {
    res.status(400).json({ error: "A package and destination are required." });
    return;
  }

  // Price comes from Airalo, never from the client.
  const pkg = await findPackage(code, packageId);
  if (!pkg || pkg.price == null) {
    res.status(404).json({ error: "That plan is no longer available. Please pick another." });
    return;
  }

  const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const [order] = await db
    .insert(esimOrdersTable)
    .values({
      userId: req.auth!.userId,
      country: code,
      packageId,
      packageTitle: pkg.title,
      dataLabel: pkg.data,
      days: pkg.days,
      amount: pkg.price.toFixed(2),
      currency: pkg.currency,
      status: "pending",
    })
    .returning({ id: esimOrdersTable.id });

  try {
    const stripe = getUncachableStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: pkg.currency.toLowerCase(),
            product_data: { name: `eSIM · ${pkg.data} · ${pkg.days ?? ""}${pkg.days ? " days" : ""} · ${code}` },
            unit_amount: Math.round(pkg.price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${appOrigin()}/esim/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin()}/destination?country=${code}`,
      metadata: { type: "esim", esimOrderId: String(order.id) },
    });
    await db.update(esimOrdersTable).set({ stripeSessionId: session.id }).where(eq(esimOrdersTable.id, order.id));
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "eSIM checkout session failed");
    await db.update(esimOrdersTable).set({ status: "failed" }).where(eq(esimOrdersTable.id, order.id));
    res.status(502).json({ error: "Couldn't start checkout. Please try again." });
  }
});

// Called when the user returns from Stripe. Verifies the payment, then places
// the Airalo order and stores the eSIM. Idempotent — safe to call more than once.
router.post("/esim/fulfill", requireAuth, async (req, res): Promise<void> => {
  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId) {
    res.status(400).json({ error: "Missing session." });
    return;
  }

  const [order] = await db
    .select()
    .from(esimOrdersTable)
    .where(and(eq(esimOrdersTable.stripeSessionId, sessionId), eq(esimOrdersTable.userId, req.auth!.userId)))
    .limit(1);
  if (!order) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  if (order.status === "fulfilled") {
    res.json({ order });
    return;
  }

  // Confirm the payment actually went through before spending our Airalo balance.
  try {
    const stripe = getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      res.status(402).json({ error: "Payment hasn't completed yet. If you paid, give it a moment and refresh." });
      return;
    }
  } catch (err) {
    logger.error({ err }, "eSIM fulfill: Stripe retrieve failed");
    res.status(502).json({ error: "Couldn't verify your payment. Please refresh in a moment." });
    return;
  }

  const placed = await placeOrder(order.packageId, `HOLTO eSIM order ${order.id}`);
  if (!placed || !placed.iccid) {
    await db.update(esimOrdersTable).set({ status: "failed" }).where(eq(esimOrdersTable.id, order.id));
    logger.error({ orderId: order.id }, "eSIM paid but Airalo order failed");
    res.status(502).json({ error: "Your payment went through, but we couldn't issue the eSIM. We'll sort it and refund if needed — please contact support." });
    return;
  }

  const [updated] = await db
    .update(esimOrdersTable)
    .set({ status: "fulfilled", airaloOrderId: placed.airaloOrderId, iccid: placed.iccid, qrCodeUrl: placed.qrCodeUrl, lpa: placed.lpa })
    .where(eq(esimOrdersTable.id, order.id))
    .returning();
  res.json({ order: updated });
});

// The traveller's eSIMs.
router.get("/esim/orders", requireAuth, async (req, res): Promise<void> => {
  const orders = await db
    .select()
    .from(esimOrdersTable)
    .where(eq(esimOrdersTable.userId, req.auth!.userId))
    .orderBy(desc(esimOrdersTable.createdAt));
  res.json({ orders });
});

router.get("/esim/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid order id." });
    return;
  }
  const [order] = await db
    .select()
    .from(esimOrdersTable)
    .where(and(eq(esimOrdersTable.id, id), eq(esimOrdersTable.userId, req.auth!.userId)))
    .limit(1);
  if (!order) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  res.json({ order });
});

export default router;
