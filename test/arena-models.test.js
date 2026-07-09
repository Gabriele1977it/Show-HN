import { test } from "node:test";
import assert from "node:assert/strict";
import { createArenaModels, isValidCatalog, BASE_PROVIDERS, openRouterToCatalog } from "../server/arena-models.js";

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

test("openRouterToCatalog groups by vendor, keeps full slugs, blends pricing", () => {
  const body = {
    data: [
      { id: "anthropic/claude-opus-4.5", name: "Anthropic: Claude Opus 4.5", pricing: { prompt: "0.000005", completion: "0.000025" }, context_length: 200000 },
      { id: "openai/gpt-5.1", name: "OpenAI: GPT-5.1", pricing: { prompt: "0.00001", completion: "0.00003" } },
      { id: "somebody/weird-model", name: "Weird Model", pricing: { prompt: "0", completion: "0" } },
      { id: "not-a-slug", name: "No Vendor" }, // skipped (no "/")
    ],
  };
  const cat = openRouterToCatalog(body);
  assert.equal(isValidCatalog(cat), true);
  // Known vendors get friendly names + brand colors.
  assert.ok(cat.Anthropic && cat.Anthropic.color === "#d97757");
  assert.ok(cat.OpenAI);
  // Model id stays a full slug (what OpenRouter's API needs); name is de-prefixed.
  const opus = cat.Anthropic.models.find((m) => m.id === "anthropic/claude-opus-4.5");
  assert.ok(opus);
  assert.equal(opus.name, "Claude Opus 4.5");
  assert.equal(opus.context, 200000);
  // Blended price: (0.000005 + 0.000025)/2 * 1000 = 0.015 per 1k.
  assert.equal(opus.costPer1k, 0.015);
  // Unknown vendor without a label prefix falls back to a title-cased slug name.
  assert.ok(cat.Somebody && cat.Somebody.models[0].id === "somebody/weird-model");
  assert.equal(cat.Somebody.models[0].costPer1k, 0); // free
  // The slug-less row was dropped.
  assert.equal(Object.values(cat).flatMap((p) => p.models).length, 3);
});

test("openRouterToCatalog honours a limit", () => {
  const body = { data: Array.from({ length: 10 }, (_, i) => ({ id: `openai/m${i}`, name: `OpenAI: M${i}`, pricing: {} })) };
  const cat = openRouterToCatalog(body, { limit: 4 });
  assert.equal(cat.OpenAI.models.length, 4);
});

test("refresh pulls the OpenRouter catalog when a key is set", async () => {
  let sawAuth = "";
  const svc = createArenaModels({
    autoStart: false,
    openrouterKey: "or-secret",
    fetchImpl: async (url, opts) => {
      sawAuth = opts.headers.Authorization;
      assert.match(url, /openrouter\.ai\/api\/v1\/models/);
      return { ok: true, json: async () => ({ data: [{ id: "x-ai/grok-4.1", name: "xAI: Grok 4.1", pricing: { prompt: "0.000015", completion: "0.000015" } }] }) };
    },
  });
  assert.equal(svc.source, "openrouter");
  assert.equal(svc.enabled, true);
  const r = await svc.refresh();
  assert.equal(sawAuth, "Bearer or-secret");
  assert.equal(r.changed, true);
  assert.ok(svc.get().providers.xAI.models.some((m) => m.id === "x-ai/grok-4.1"));
});

test("a custom feed URL takes precedence over an OpenRouter key", async () => {
  const svc = createArenaModels({
    autoStart: false,
    upstreamUrl: "https://feed.example/models.json",
    openrouterKey: "or-secret",
    fetchImpl: async (url) => {
      assert.match(url, /feed\.example/); // never hits OpenRouter
      return { ok: true, json: async () => ({ providers: { FeedCo: { color: "#111111", models: [{ id: "feedco-1", name: "FeedCo 1" }] } } }) };
    },
  });
  assert.equal(svc.source, "feed");
  await svc.refresh();
  assert.ok(svc.get().providers.FeedCo);
});

test("isValidCatalog accepts the base catalog and rejects junk", () => {
  assert.equal(isValidCatalog(BASE_PROVIDERS), true);
  assert.equal(isValidCatalog(null), false);
  assert.equal(isValidCatalog({}), false);
  assert.equal(isValidCatalog({ P: { color: "#fff", models: [{ id: "a" }] } }), false); // model missing name
  assert.equal(isValidCatalog({ P: { color: "#fff", models: [{ id: "a", name: "A" }] } }), true);
});
