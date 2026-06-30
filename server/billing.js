// Billing (Stripe).
//
// Uses Stripe's REST API directly over fetch (no SDK dependency). When no
// secret key is configured it runs in "dev mode": the checkout call applies the
// plan immediately so the upgrade flow is demoable without live keys.
//
// Going live needs three env vars (see README): STRIPE_SECRET_KEY,
// STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM, and STRIPE_WEBHOOK_SECRET for webhooks.

import { createHmac, timingSafeEqual } from "node:crypto";

export function createBilling({ store, config = {}, fetchImpl = fetch }) {
  const enabled = Boolean(config.secretKey);
  const prices = { pro: config.pricePro, team: config.priceTeam };

  async function createCheckout({ workspaceId, plan, successUrl, cancelUrl }) {
    if (plan !== "pro" && plan !== "team") throw new Error("Unknown plan");

    if (!enabled) {
      // Dev mode: no Stripe configured — upgrade immediately so the flow works.
      store.setWorkspacePlan(workspaceId, plan, { provider: "dev", status: "active" });
      return { url: successUrl, dev: true };
    }

    const price = prices[plan];
    if (!price) throw new Error(`No Stripe price configured for the ${plan} plan`);
    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[workspaceId]": workspaceId,
      "metadata[plan]": plan,
      "subscription_data[metadata][workspaceId]": workspaceId,
      "subscription_data[metadata][plan]": plan,
    });
    const res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Stripe checkout failed (${res.status})`);
    const data = await res.json();
    return { url: data.url, id: data.id };
  }

  /** Verify a Stripe webhook signature (t=…,v1=… HMAC-SHA256 scheme). */
  function verifyWebhook(payload, sigHeader, secret = config.webhookSecret) {
    if (!secret || !sigHeader) return false;
    const parts = Object.fromEntries(String(sigHeader).split(",").map((kv) => kv.split("=")));
    if (!parts.t || !parts.v1) return false;
    const expected = createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(parts.v1);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Apply a (already-verified) Stripe event to workspace plan state. */
  function applyEvent(event) {
    const obj = event?.data?.object ?? {};
    switch (event?.type) {
      case "checkout.session.completed": {
        const ws = obj.metadata?.workspaceId;
        const plan = obj.metadata?.plan;
        if (ws && plan) store.setWorkspacePlan(ws, plan, { provider: "stripe", customerId: obj.customer, subscriptionId: obj.subscription, status: "active" });
        return { handled: true };
      }
      case "customer.subscription.updated": {
        const ws = obj.metadata?.workspaceId;
        if (ws) {
          const active = obj.status === "active" || obj.status === "trialing";
          const plan = active ? (obj.metadata?.plan || store.getWorkspacePlan(ws)) : "free";
          store.setWorkspacePlan(ws, plan, { provider: "stripe", subscriptionId: obj.id, status: obj.status });
        }
        return { handled: true };
      }
      case "customer.subscription.deleted": {
        const ws = obj.metadata?.workspaceId || store.findWorkspaceBySubscription(obj.id);
        if (ws) store.setWorkspacePlan(ws, "free", { provider: "stripe", status: "canceled" });
        return { handled: true };
      }
      default:
        return { handled: false };
    }
  }

  return { enabled, createCheckout, verifyWebhook, applyEvent };
}
