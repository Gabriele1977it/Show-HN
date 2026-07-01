import { test } from "node:test";
import assert from "node:assert/strict";
import { createEnricher } from "../server/enrich.js";

test("enricher is disabled with no key and no injected generator", async () => {
  const e = createEnricher({});
  assert.equal(e.enabled, false);
  assert.deepEqual(await e.enrich("hola", "Spanish"), { error: "not-configured" });
});

test("enricher runs the injected generator when enabled", async () => {
  const calls = [];
  const e = createEnricher({
    generate: async (front, language) => { calls.push([front, language]); return { back: `EN(${front})`, notes: `lang=${language}` }; },
  });
  assert.equal(e.enabled, true);
  const out = await e.enrich("こんにちは", "Japanese");
  assert.deepEqual(out, { back: "EN(こんにちは)", notes: "lang=Japanese" });
  assert.deepEqual(calls, [["こんにちは", "Japanese"]]);
});

test("enricher guards against empty input", async () => {
  const e = createEnricher({ generate: async () => ({ back: "x", notes: "y" }) });
  assert.deepEqual(await e.enrich("   ", "Spanish"), { error: "empty" });
});

test("an API key alone enables the enricher (real client constructed lazily)", () => {
  const e = createEnricher({ apiKey: "sk-test", model: "test-model" });
  assert.equal(e.enabled, true);
  assert.equal(e.model, "test-model");
});
