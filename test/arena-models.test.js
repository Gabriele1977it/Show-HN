import { test } from "node:test";
import assert from "node:assert/strict";
import { createArenaModels, isValidCatalog, BASE_PROVIDERS } from "../server/arena-models.js";

test("serves the base catalog with a version and timestamp", () => {
  const svc = createArenaModels({ autoStart: false });
  const snap = svc.get();
  assert.equal(snap.version, 1);
  assert.equal(typeof snap.updatedAt, "number");
  assert.ok(snap.providers.OpenAI.models.some((m) => m.id === "gpt-5.1"));
});

test("promoteNext adds one upcoming model and bumps the version", () => {
  const svc = createArenaModels({ autoStart: false });
  const v0 = svc.get().version;
  const promoted = svc.promoteNext();
  assert.ok(promoted && promoted.id && promoted.provider);
  const snap = svc.get();
  assert.equal(snap.version, v0 + 1);
  assert.ok(snap.providers[promoted.provider].models.some((m) => m.id === promoted.id));
});

test("promotion drains the pool and then returns null", () => {
  const upcoming = [
    { provider: "OpenAI", id: "x-1", name: "X1" },
    { provider: "OpenAI", id: "x-2", name: "X2" },
  ];
  const svc = createArenaModels({ autoStart: false, upcoming });
  assert.ok(svc.promoteNext());
  assert.ok(svc.promoteNext());
  assert.equal(svc.promoteNext(), null);
  assert.equal(svc.get().version, 3); // 1 base + 2 promotions
});

test("refresh pulls a valid upstream feed and swaps the catalog in", async () => {
  const feed = {
    providers: {
      NewCo: { color: "#123456", models: [{ id: "newco-1", name: "NewCo 1", costPer1k: 0.001, latency: 1 }] },
    },
  };
  const svc = createArenaModels({
    autoStart: false,
    upstreamUrl: "https://feed.example/models.json",
    fetchImpl: async () => ({ ok: true, json: async () => feed }),
  });
  const r = await svc.refresh();
  assert.equal(r.changed, true);
  assert.equal(svc.get().version, 2);
  assert.ok(svc.get().providers.NewCo);

  // A second identical refresh is a no-op (no version bump).
  const r2 = await svc.refresh();
  assert.equal(r2.changed, false);
  assert.equal(svc.get().version, 2);
});

test("refresh ignores an invalid or unreachable feed without throwing", async () => {
  const svc = createArenaModels({
    autoStart: false,
    upstreamUrl: "https://feed.example/models.json",
    fetchImpl: async () => ({ ok: true, json: async () => ({ providers: { Bad: {} } }) }),
  });
  const r = await svc.refresh();
  assert.equal(r.changed, false);
  assert.equal(svc.get().version, 1); // untouched

  const svc2 = createArenaModels({
    autoStart: false,
    upstreamUrl: "https://feed.example/models.json",
    fetchImpl: async () => { throw new Error("network down"); },
  });
  assert.equal((await svc2.refresh()).changed, false);
  assert.equal(svc2.get().version, 1);
});

test("isValidCatalog accepts the base catalog and rejects junk", () => {
  assert.equal(isValidCatalog(BASE_PROVIDERS), true);
  assert.equal(isValidCatalog(null), false);
  assert.equal(isValidCatalog({}), false);
  assert.equal(isValidCatalog({ P: { color: "#fff", models: [{ id: "a" }] } }), false); // model missing name
  assert.equal(isValidCatalog({ P: { color: "#fff", models: [{ id: "a", name: "A" }] } }), true);
});
