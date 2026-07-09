import { test } from "node:test";
import assert from "node:assert/strict";
import { createArenaRunner, createOpenAICompatibleAdapter, createGeminiAdapter } from "../server/arena-run.js";

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

test("OpenAI-compatible adapter builds the request and parses the response", async () => {
  let captured;
  const adapter = createOpenAICompatibleAdapter({
    apiKey: "sk-test", baseURL: "https://api.openai.com/v1",
    resolveModel: (id) => (id === "gpt-5.1" ? "gpt-4o" : id), defaultModel: "gpt-4o",
    fetchImpl: async (url, opts) => {
      captured = { url, opts };
      return { ok: true, json: async () => ({ choices: [{ message: { content: "  hi there  " } }], usage: { prompt_tokens: 11, completion_tokens: 4 } }) };
    },
  });
  const out = await adapter({ model: "gpt-5.1", prompt: "Draft an email", maxTokens: 200 });
  assert.equal(captured.url, "https://api.openai.com/v1/chat/completions");
  assert.match(captured.opts.headers.Authorization, /^Bearer sk-test$/);
  const body = JSON.parse(captured.opts.body);
  assert.equal(body.model, "gpt-4o");          // resolved
  assert.equal(body.messages[0].content, "Draft an email");
  assert.equal(out.output, "hi there");         // trimmed
  assert.equal(out.promptTokens, 11);
  assert.equal(out.completionTokens, 4);
});

test("OpenAI-compatible adapter throws on a non-ok response (→ runner degrades to sim)", async () => {
  const adapter = createOpenAICompatibleAdapter({
    apiKey: "k", baseURL: "https://api.x.ai/v1", fetchImpl: async () => ({ ok: false, status: 429 }),
  });
  await assert.rejects(adapter({ model: "grok-4", prompt: "p", maxTokens: 50 }), /HTTP 429/);
});

test("Gemini adapter builds the URL + body and parses candidates/usage", async () => {
  let captured;
  const adapter = createGeminiAdapter({
    apiKey: "gkey", resolveModel: (id) => id, defaultModel: "gemini-2.5-flash",
    fetchImpl: async (url, opts) => {
      captured = { url, opts };
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "part1 " }, { text: "part2" }] } }], usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 7 } }) };
    },
  });
  const out = await adapter({ model: "gemini-3-pro", prompt: "hello", maxTokens: 128 });
  assert.match(captured.url, /models\/gemini-3-pro:generateContent\?key=gkey/);
  const body = JSON.parse(captured.opts.body);
  assert.equal(body.contents[0].parts[0].text, "hello");
  assert.equal(body.generationConfig.maxOutputTokens, 128);
  assert.equal(out.output, "part1 part2");
  assert.equal(out.promptTokens, 20);
  assert.equal(out.completionTokens, 7);
});

test("adapters return null without a key", () => {
  assert.equal(createOpenAICompatibleAdapter({ apiKey: "", baseURL: "x" }), null);
  assert.equal(createGeminiAdapter({ apiKey: "" }), null);
});

test("OpenRouter-style: extraHeaders + prefixed model resolution", async () => {
  let captured;
  const adapter = createOpenAICompatibleAdapter({
    apiKey: "or-key", baseURL: "https://openrouter.ai/api/v1",
    resolveModel: (id) => `anthropic/${id}`,          // per-provider slug prefix
    extraHeaders: { "HTTP-Referer": "https://echodeck.madlabs.uk/arena", "X-Title": "Agent Arena" },
    fetchImpl: async (url, opts) => {
      captured = { url, opts };
      return { ok: true, json: async () => ({ choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }) };
    },
  });
  await adapter({ model: "claude-opus-4.5", prompt: "hi", maxTokens: 50 });
  assert.equal(captured.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(captured.opts.headers["HTTP-Referer"], "https://echodeck.madlabs.uk/arena");
  assert.equal(captured.opts.headers["X-Title"], "Agent Arena");
  assert.equal(JSON.parse(captured.opts.body).model, "anthropic/claude-opus-4.5");
});
