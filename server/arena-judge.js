// Agent Arena — LLM-as-judge.
//
// After a real run, an impartial "judge" model scores each live output against
// the task, turning the arena's simulated score heuristic into a real, defended
// evaluation. Provider-agnostic and off by default (needs a judge adapter):
// injected in tests, or built from ANTHROPIC_API_KEY in index.js — so the whole
// path is exercisable without a live key. Never throws: a failing judge call
// leaves that card on the simulated score rather than breaking the run.
//
// A judge is: async ({ task, prompt, output }) => { accuracy, relevance, overall,
//   promptTokens, completionTokens }  (scores 0–100)

const clamp100 = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

export function createArenaJudge({ judge, enabled = Boolean(judge), model = "" } = {}) {
  const on = Boolean(enabled) && typeof judge === "function";
  return {
    get enabled() { return on; },
    model,
    // Returns { accuracy, relevance, overall, promptTokens, completionTokens }
    // or null when disabled / on any error (caller falls back to simulation).
    async score({ task, prompt, output }) {
      if (!on || !String(output || "").trim()) return null;
      try {
        const r = await judge({ task: String(task || "").slice(0, 200), prompt: String(prompt || "").slice(0, 4000), output: String(output).slice(0, 4000) });
        if (!r) return null;
        const accuracy = clamp100(r.accuracy);
        const relevance = clamp100(r.relevance);
        const overall = r.overall != null ? clamp100(r.overall) : Math.round((accuracy + relevance) / 2);
        return {
          accuracy, relevance, overall,
          promptTokens: Number(r.promptTokens) || 0,
          completionTokens: Number(r.completionTokens) || 0,
        };
      } catch {
        return null;
      }
    },
  };
}

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    accuracy: { type: "integer", description: "0–100: does the answer correctly and completely address the task?" },
    relevance: { type: "integer", description: "0–100: is the answer on-topic, well-targeted, and free of fluff?" },
    overall: { type: "integer", description: "0–100: overall quality for the task." },
  },
  required: ["accuracy", "relevance", "overall"],
  additionalProperties: false,
};

const JUDGE_SYSTEM = [
  "You are an impartial evaluator of AI answers to business tasks.",
  "Score the answer only on how well it serves the task — not its length or style.",
  "Be calibrated: an excellent answer scores 85–100, a solid one 60–84, a weak one below 60.",
].join(" ");

// Build a real Anthropic judge from an API key, reusing the SDK the app already
// depends on. Returns null when no key is set.
export async function createAnthropicJudge({ apiKey, model = "claude-haiku-4-5-20251001", maxTokens = 200 }) {
  if (!apiKey) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  return async function anthropicJudge({ task, prompt, output }) {
    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: JUDGE_SYSTEM,
      output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
      messages: [{ role: "user", content: `Task: ${task}\n\nInstructions given to the model:\n${prompt}\n\nThe model's answer:\n${output}\n\nScore it.` }],
    });
    const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
    const parsed = JSON.parse(text);
    return {
      accuracy: parsed.accuracy, relevance: parsed.relevance, overall: parsed.overall,
      promptTokens: res.usage?.input_tokens ?? 0,
      completionTokens: res.usage?.output_tokens ?? 0,
    };
  };
}

// Pull the first {...} JSON object out of a model's text reply (defensive: some
// models wrap JSON in prose or code fences).
function extractJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
  return {};
}

// OpenAI-compatible judge (works via OpenRouter, OpenAI, xAI, …). Asks for a
// JSON score in the prompt and parses it — no provider-specific structured-
// output API required, so it runs against any OpenAI-style endpoint.
export function createOpenAICompatibleJudge({ apiKey, baseURL, model, extraHeaders = {}, maxTokens = 200, fetchImpl }) {
  if (!apiKey) return null;
  const doFetch = fetchImpl || globalThis.fetch;
  return async function openAICompatibleJudge({ task, prompt, output }) {
    const res = await doFetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: JUDGE_SYSTEM + ' Respond with ONLY a JSON object: {"accuracy":0-100,"relevance":0-100,"overall":0-100}.' },
          { role: "user", content: `Task: ${task}\n\nInstructions given to the model:\n${prompt}\n\nThe model's answer:\n${output}\n\nScore it as JSON.` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`judge HTTP ${res.status}`);
    const data = await res.json();
    const parsed = extractJson(data.choices?.[0]?.message?.content ?? "{}");
    return {
      accuracy: parsed.accuracy, relevance: parsed.relevance, overall: parsed.overall,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    };
  };
}
