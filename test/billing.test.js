import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createBilling } from "../server/billing.js";

// Minimal fake store that records plan changes.
function fakeStore() {
  const plans = {};
  return {
    plans,
    setWorkspacePlan: (ws, plan, billing) => { plans[ws] = { plan, billing }; },
    getWorkspacePlan: (ws) => plans[ws]?.plan ?? "free",
    findWorkspaceBySubscription: (sub) => Object.keys(plans).find((ws) => plans[ws]?.billing?.subscriptionId === sub) ?? null,
  };
}

test("dev mode (no key) upgrades immediately and returns the success url", async () => {
  const store = fakeStore();
  const billing = createBilling({ store, config: {} });
  assert.equal(billing.enabled, false);
  const r = await billing.createCheckout({ workspaceId: "w1", plan: "pro", successUrl: "/ok", cancelUrl: "/no" });
  assert.equal(r.dev, true);
  assert.equal(r.url, "/ok");
  assert.equal(store.getWorkspacePlan("w1"), "pro");
});

test("with a key, createCheckout calls Stripe with the right payload", async () => {
  const store = fakeStore();
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return { ok: true, json: async () => ({ url: "https://checkout", id: "cs_1" }) }; };
  const billing = createBilling({ store, config: { secretKey: "sk_test", pricePro: "price_pro" }, fetchImpl });
  const r = await billing.createCheckout({ workspaceId: "w9", plan: "pro", successUrl: "/ok", cancelUrl: "/no" });
  assert.equal(r.url, "https://checkout");
  assert.match(calls[0].url, /checkout\/sessions/);
  assert.match(calls[0].opts.headers.Authorization, /Bearer sk_test/);
  const body = calls[0].opts.body;
  assert.match(body, /line_items%5B0%5D%5Bprice%5D=price_pro/);
  assert.match(body, /metadata%5BworkspaceId%5D=w9/);
});

test("createCheckout rejects unknown plans", async () => {
  const billing = createBilling({ store: fakeStore(), config: {} });
  await assert.rejects(billing.createCheckout({ workspaceId: "w", plan: "gold", successUrl: "/", cancelUrl: "/" }), /Unknown plan/);
});

test("verifyWebhook accepts a correctly signed payload and rejects tampering", () => {
  const secret = "whsec_test";
  const billing = createBilling({ store: fakeStore(), config: { webhookSecret: secret } });
  const payload = JSON.stringify({ type: "ping" });
  const t = 1700000000;
  const sig = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  assert.equal(billing.verifyWebhook(payload, `t=${t},v1=${sig}`), true);
  assert.equal(billing.verifyWebhook(payload + "x", `t=${t},v1=${sig}`), false);
  assert.equal(billing.verifyWebhook(payload, "t=1,v1=deadbeef"), false);
  assert.equal(billing.verifyWebhook(payload, null), false);
});

test("applyEvent upgrades on checkout and downgrades on cancellation", () => {
  const store = fakeStore();
  const billing = createBilling({ store, config: {} });

  billing.applyEvent({ type: "checkout.session.completed", data: { object: { metadata: { workspaceId: "w1", plan: "team" }, customer: "cus_1", subscription: "sub_1" } } });
  assert.equal(store.getWorkspacePlan("w1"), "team");

  billing.applyEvent({ type: "customer.subscription.deleted", data: { object: { id: "sub_1", metadata: { workspaceId: "w1" } } } });
  assert.equal(store.getWorkspacePlan("w1"), "free");

  // Unknown event types are ignored.
  assert.deepEqual(billing.applyEvent({ type: "invoice.paid", data: { object: {} } }), { handled: false });
});
