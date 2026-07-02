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

test("model defaults to the budget tier and honours the ANTHROPIC_MODEL alias", () => {
  const oldModel = process.env.ECHODECK_LLM_MODEL;
  const oldAlias = process.env.ANTHROPIC_MODEL;
  delete process.env.ECHODECK_LLM_MODEL;
  delete process.env.ANTHROPIC_MODEL;
  try {
    // Cheap by default: card fills are short structured completions.
    assert.equal(createEnricher({ apiKey: "sk-test" }).model, "claude-haiku-4-5-20251001");
    // The Render-friendly alias works…
    process.env.ANTHROPIC_MODEL = "claude-3-haiku-20240307";
    assert.equal(createEnricher({ apiKey: "sk-test" }).model, "claude-3-haiku-20240307");
    // …but ECHODECK_LLM_MODEL still wins when both are set.
    process.env.ECHODECK_LLM_MODEL = "claude-haiku-4-5-20251001";
    assert.equal(createEnricher({ apiKey: "sk-test" }).model, "claude-haiku-4-5-20251001");
  } finally {
    if (oldModel === undefined) delete process.env.ECHODECK_LLM_MODEL; else process.env.ECHODECK_LLM_MODEL = oldModel;
    if (oldAlias === undefined) delete process.env.ANTHROPIC_MODEL; else process.env.ANTHROPIC_MODEL = oldAlias;
  }
});

test("output tokens are capped by default and configurable", () => {
  assert.equal(createEnricher({ apiKey: "sk-test" }).maxTokens, 300);
  assert.equal(createEnricher({ apiKey: "sk-test", maxTokens: 150 }).maxTokens, 150);
});
