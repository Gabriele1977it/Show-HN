import { test } from "node:test";
import assert from "node:assert/strict";
import { createPushService, deliverToWorkspace } from "../server/push.js";

test("push is disabled without keys or an injected sender", async () => {
  const p = createPushService({});
  assert.equal(p.enabled, false);
  assert.equal(p.publicKey, null);
  assert.deepEqual(await p.notify({ endpoint: "x" }, { title: "hi" }), { ok: false, error: "not-configured" });
});

test("an injected sender enables push and receives a JSON payload", async () => {
  const sent = [];
  const p = createPushService({ publicKey: "pub-key", send: async (sub, payload) => sent.push({ sub, payload }) });
  assert.equal(p.enabled, true);
  assert.equal(p.publicKey, "pub-key");
  await p.notify({ endpoint: "e1" }, { title: "T", body: "B" });
  assert.equal(sent.length, 1);
  assert.deepEqual(JSON.parse(sent[0].payload), { title: "T", body: "B" });
});

test("deliverToWorkspace fans out to all subs and prunes dead ones", async () => {
  const subs = [{ endpoint: "live" }, { endpoint: "dead" }];
  const pruned = [];
  const store = {
    listPushSubscriptions: () => subs,
    removePushSubscription: (_ws, endpoint) => pruned.push(endpoint),
  };
  const push = createPushService({
    publicKey: "k",
    send: async (sub) => { if (sub.endpoint === "dead") { const e = new Error("gone"); e.statusCode = 410; throw e; } },
  });
  const res = await deliverToWorkspace({ store, push, workspaceId: "ws1", message: { title: "t", body: "b" } });
  assert.deepEqual(res, { pushed: 1, pruned: 1 });
  assert.deepEqual(pruned, ["dead"]);
});

test("deliverToWorkspace is a no-op when push is disabled", async () => {
  const res = await deliverToWorkspace({ store: {}, push: createPushService({}), workspaceId: "ws", message: {} });
  assert.deepEqual(res, { pushed: 0, pruned: 0 });
});
