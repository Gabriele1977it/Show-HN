import { test } from "node:test";
import assert from "node:assert/strict";
import { createArenaRunner } from "../server/arena-run.js";

test("runner is disabled with no adapters", async () => {
  const r = createArenaRunner({ adapters: {} });
  assert.equal(r.enabled, false);
  assert.deepEqual(await r.run({ provider: "Anthropic", model: "claude-opus-4.5", prompt: "hi" }), { live: false });
});

test("runner is disabled when adapters exist but enabled=false", async () => {
  const r = createArenaRunner({
    adapters: { Anthropic: async () => ({ output: "x" }) },
    enabled: false,
  });
  assert.equal(r.enabled, false);
  assert.equal((await r.run({ provider: "Anthropic", model: "m", prompt: "p" })).live, false);
});

test("runs a real adapter and returns live output + measured latency/tokens", async () => {
  const r = createArenaRunner({
    adapters: {
      Anthropic: async ({ model, prompt, maxTokens }) => {
        assert.equal(typeof maxTokens, "number");
        return { output: `echo(${model}): ${prompt}`, promptTokens: 12, completionTokens: 8 };
      },
    },
  });
  assert.equal(r.enabled, true);
  const out = await r.run({ provider: "Anthropic", model: "claude-opus-4.5", prompt: "Draft an email" });
  assert.equal(out.live, true);
  assert.match(out.output, /echo\(claude-opus-4\.5\): Draft an email/);
  assert.equal(out.promptTokens, 12);
  assert.equal(out.completionTokens, 8);
  assert.equal(typeof out.latencyMs, "number");
});

test("a provider with no adapter falls back to simulation (live:false)", async () => {
  const r = createArenaRunner({ adapters: { Anthropic: async () => ({ output: "x" }) } });
  assert.equal((await r.run({ provider: "OpenAI", model: "gpt-5.1", prompt: "p" })).live, false);
});

test("an adapter that throws degrades to simulation without throwing", async () => {
  const r = createArenaRunner({ adapters: { Anthropic: async () => { throw new Error("429 rate limited"); } } });
  const out = await r.run({ provider: "Anthropic", model: "m", prompt: "p" });
  assert.equal(out.live, false);
  assert.match(out.error, /rate limited/);
});

test("an adapter that returns empty output degrades to simulation", async () => {
  const r = createArenaRunner({ adapters: { Anthropic: async () => ({ output: "   " }) } });
  assert.equal((await r.run({ provider: "Anthropic", model: "m", prompt: "p" })).live, false);
});

test("runMany preserves order and mixes live + simulated providers", async () => {
  const r = createArenaRunner({ adapters: { Anthropic: async () => ({ output: "real" }) } });
  const results = await r.runMany({
    prompt: "p",
    models: [
      { id: "gpt-5.1", provider: "OpenAI" },
      { id: "claude-opus-4.5", provider: "Anthropic" },
    ],
  });
  assert.equal(results.length, 2);
  assert.equal(results[0].id, "gpt-5.1");
  assert.equal(results[0].live, false);
  assert.equal(results[1].id, "claude-opus-4.5");
  assert.equal(results[1].live, true);
  assert.equal(results[1].output, "real");
});

test("prompt is truncated to maxPromptChars before reaching the adapter", async () => {
  let seen = "";
  const r = createArenaRunner({
    adapters: { Anthropic: async ({ prompt }) => { seen = prompt; return { output: "ok" }; } },
    maxPromptChars: 10,
  });
  await r.run({ provider: "Anthropic", model: "m", prompt: "x".repeat(50) });
  assert.equal(seen.length, 10);
});
