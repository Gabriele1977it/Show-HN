// Agent Arena — real model runs (opt-in).
//
// By default the arena is a pure demo: outputs are simulated in the browser.
// When an operator configures a provider key AND explicitly enables live runs
// (ARENA_LIVE=1), the arena can call real models server-side for the providers
// it has an adapter for. Any model whose provider has no adapter falls back to
// the browser simulation, so a live run can mix real + simulated cards.
//
// Provider-agnostic, mirroring enrich/email/transcribe: adapters are injected
// (real ones built from keys in index.js; fakes in tests), so the whole feature
// is exercisable without a live key. Never throws — a failing provider call
// degrades that one card to simulated rather than failing the run.

// An adapter is: async ({ model, prompt, maxTokens }) => { output, promptTokens, completionTokens }

export function createArenaRunner({
  adapters = {},
  enabled = Object.keys(adapters).length > 0,
  maxOutputTokens = 400,
  maxPromptChars = 4000,
  now = () => (globalThis.performance?.now?.() ?? Date.now()),
} = {}) {
  const providers = Object.keys(adapters);
  const live = Boolean(enabled) && providers.length > 0;

  async function run({ provider, model, prompt }) {
    const adapter = adapters[provider];
    if (!live || !adapter) return { live: false };
    const t0 = now();
    try {
      const out = await adapter({
        model,
        prompt: String(prompt || "").slice(0, maxPromptChars),
        maxTokens: maxOutputTokens,
      });
      const output = String(out?.output ?? "").trim();
      if (!output) return { live: false };
      return {
        live: true,
        output,
        promptTokens: Number(out.promptTokens) || 0,
        completionTokens: Number(out.completionTokens) || 0,
        latencyMs: Math.round(now() - t0),
      };
    } catch (err) {
      // Degrade this card to simulation; surface nothing to the client but the
      // absence of `live`.
      return { live: false, error: err?.message || String(err) };
    }
  }

  return {
    get enabled() { return live; },
    providers: () => providers.slice(),
    run,
    // Run several models concurrently; returns one result per input (same order).
    async runMany({ prompt, models }) {
      return Promise.all(
        (models || []).map(async (m) => ({ id: m.id, ...(await run({ provider: m.provider, model: m.id, prompt })) })),
      );
    },
  };
}

// Build a real Anthropic adapter from an API key, reusing the SDK the repo
// already depends on. `resolveModel` maps an arena model id (e.g.
// "claude-opus-4.5") to a real Anthropic API model string; unknown ids fall
// back to `defaultModel`. Returns null when no key is set.
export async function createAnthropicAdapter({ apiKey, resolveModel, defaultModel }) {
  if (!apiKey) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  const resolve = resolveModel || (() => defaultModel);
  return async function anthropicAdapter({ model, prompt, maxTokens }) {
    const apiModel = resolve(model) || defaultModel;
    const res = await client.messages.create({
      model: apiModel,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    const output = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return {
      output,
      promptTokens: res.usage?.input_tokens ?? 0,
      completionTokens: res.usage?.output_tokens ?? 0,
    };
  };
}
