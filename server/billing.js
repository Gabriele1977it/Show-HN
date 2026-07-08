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
  // Prices are keyed by plan and billing interval. Monthly keys keep their
  // original names for backward compatibility; annual keys are optional.
  const prices = {
    pro: { month: config.pricePro, year: config.priceProYear },
    team: { month: config.priceTeam, year: config.priceTeamYear },
  };
  // Annual checkout is offerable when either we're in dev mode (upgrade applies
  // immediately, no Stripe price needed) or both live annual prices are set.
  // The UI uses this to avoid showing an annual option that would error.
  const annualAvailable = !enabled || Boolean(prices.pro.year && prices.team.year);

  async function createCheckout({ workspaceId, plan, interval = "month", successUrl, cancelUrl }) {
    if (plan !== "pro" && plan !== "team") throw new Error("Unknown plan");
    if (interval !== "month" && interval !== "year") throw new Error("Unknown billing interval");

    if (!enabled) {
      // Dev mode: no Stripe configured — upgrade immediately so the flow works.
      store.setWorkspacePlan(workspaceId, plan, { provider: "dev", status: "active" });
      return { url: successUrl, dev: true };
    }

    const price = prices[plan][interval];
    if (!price) throw new Error(`No Stripe price configured for the ${plan} plan (${interval})`);
    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[workspaceId]": workspaceId,
      "metadata[plan]": plan,
      "metadata[interval]": interval,
      "subscription_data[metadata][workspaceId]": workspaceId,
      "subscription_data[metadata][plan]": plan,
      "subscription_data[metadata][interval]": interval,
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

  // Grant a plan's monthly credit allowance (as an "allowance" ledger entry).
  function grantAllowance(userId, monthlyCredits, plan) {
    if (userId && monthlyCredits > 0) store.addArenaCredits(userId, monthlyCredits, { kind: "allowance", plan });
  }

  /**
   * Agent Arena subscription (account-level). Dev mode sets the plan + grants
   * its monthly credit allowance immediately; live mode opens a Stripe
   * subscription Checkout and does the same via the webhook.
   */
  async function createArenaSubscription({ userId, plan, priceId, monthlyCredits = 0, successUrl, cancelUrl }) {
    if (!enabled) {
      store.setArenaAccountPlan(userId, plan, { provider: "dev", status: "active" });
      grantAllowance(userId, monthlyCredits, plan);
      return { url: successUrl, dev: true, plan };
    }
    if (!priceId) throw new Error(`No Stripe price configured for the Arena ${plan} plan`);
    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[kind]": "arena-sub",
      "metadata[userId]": userId,
      "metadata[plan]": plan,
      "metadata[monthlyCredits]": String(monthlyCredits),
      "subscription_data[metadata][kind]": "arena-sub",
      "subscription_data[metadata][userId]": userId,
      "subscription_data[metadata][plan]": plan,
      "subscription_data[metadata][monthlyCredits]": String(monthlyCredits),
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

  /**
   * One-time Agent Arena credit top-up (Stripe Checkout in `payment` mode, or
   * an instant grant in dev mode). Amount is an arbitrary number of cents, so
   * we use ad-hoc price_data rather than a fixed Stripe Price.
   */
  async function createCreditsCheckout({ userId, cents, successUrl, cancelUrl }) {
    const amount = Math.max(50, Math.round(cents)); // Stripe min is 50c
    if (!enabled) {
      // Dev mode: no Stripe — credit the wallet immediately so the flow works.
      const { credits } = store.addArenaCredits(userId, amount, { provider: "dev" });
      return { url: successUrl, dev: true, credits };
    }
    const body = new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(amount),
      "line_items[0][price_data][product_data][name]": "Agent Arena credits",
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[kind]": "arena-credits",
      "metadata[userId]": userId,
      "metadata[cents]": String(amount),
      "payment_intent_data[metadata][kind]": "arena-credits",
      "payment_intent_data[metadata][userId]": userId,
      "payment_intent_data[metadata][cents]": String(amount),
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

  /**
   * Open the Stripe billing portal so a customer can manage / cancel. In dev
   * mode (no keys) there's nothing to manage, so we simulate a cancellation by
   * downgrading the workspace to Free.
   */
  async function createPortal({ workspaceId, returnUrl }) {
    if (!enabled) {
      store.setWorkspacePlan(workspaceId, "free", { provider: "dev", status: "canceled" });
      return { url: returnUrl, dev: true };
    }
    const billingState = store.getBilling(workspaceId);
    const customer = billingState?.customerId;
    if (!customer) throw new Error("No Stripe customer for this workspace");
    const body = new URLSearchParams({ customer, return_url: returnUrl });
    const res = await fetchImpl("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Stripe portal failed (${res.status})`);
    const data = await res.json();
    return { url: data.url };
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
        // Agent Arena credit top-up (one-time payment).
        if (obj.metadata?.kind === "arena-credits" && obj.metadata?.userId) {
          store.addArenaCredits(obj.metadata.userId, Number(obj.metadata.cents) || 0, { provider: "stripe", sessionId: obj.id });
          return { handled: true };
        }
        // Agent Arena subscription — set plan + grant the monthly allowance.
        if (obj.metadata?.kind === "arena-sub" && obj.metadata?.userId) {
          store.setArenaAccountPlan(obj.metadata.userId, obj.metadata.plan, { provider: "stripe", customerId: obj.customer, subscriptionId: obj.subscription, status: "active" });
          grantAllowance(obj.metadata.userId, Number(obj.metadata.monthlyCredits) || 0, obj.metadata.plan);
          return { handled: true };
        }
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
        if (obj.metadata?.kind === "arena-sub" && obj.metadata?.userId) {
          store.setArenaAccountPlan(obj.metadata.userId, "free", { provider: "stripe", status: "canceled" });
          return { handled: true };
        }
        const ws = obj.metadata?.workspaceId || store.findWorkspaceBySubscription(obj.id);
        if (ws) store.setWorkspacePlan(ws, "free", { provider: "stripe", status: "canceled" });
        return { handled: true };
      }
      default:
        return { handled: false };
    }
  }

  return { enabled, annualAvailable, createCheckout, createCreditsCheckout, createArenaSubscription, createPortal, verifyWebhook, applyEvent };
}
