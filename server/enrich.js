// AI card-back auto-fill.
//
// Given a card's front (a sentence in the target language), generate the "back":
// a natural translation plus a short study note (key vocab / grammar + one
// example). This removes the most tedious step in the ingest loop.
//
// Provider-agnostic in spirit, mirroring email/reminders: the real call goes
// through the official Anthropic SDK when ANTHROPIC_API_KEY is set; with no key
// the service reports `enabled: false` and the routes return a clear message.
// A `generate` function can be injected (tests, or an alternate provider),
// which keeps the whole feature exercisable without a live key.

import Anthropic from "@anthropic-ai/sdk";

// Structured-output schema: the model must return exactly these fields, so the
// server never has to parse free-form prose.
const CARD_SCHEMA = {
  type: "object",
  properties: {
    translation: { type: "string", description: "A natural English translation of the sentence." },
    notes: { type: "string", description: "A concise study note (~40 words): key vocabulary or grammar points, and one short example sentence." },
  },
  required: ["translation", "notes"],
  additionalProperties: false,
};

const SYSTEM = [
  "You help build language-learning flashcards.",
  "Given a sentence in the target language, produce a natural English translation",
  "and a concise study note covering the key vocabulary or grammar point plus one",
  "short example. Keep the note under ~40 words. If the sentence is already English",
  "or trivial, translate/echo it and keep the note minimal.",
].join(" ");

// Model: cheap-by-default. Card fills are short, structured completions — the
// budget tier handles them well, and the operator pays per token. Override via
// ECHODECK_LLM_MODEL (or its alias ANTHROPIC_MODEL).
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export function createEnricher({
  apiKey,
  model = process.env.ECHODECK_LLM_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
  // Hard per-call output cap: a translation + ~40-word note fits comfortably in
  // 300 tokens, so a runaway response can never bill more than this.
  maxTokens = Number(process.env.ECHODECK_LLM_MAX_TOKENS) || 300,
  generate,
} = {}) {
  const enabled = Boolean(generate || apiKey);
  const client = !generate && apiKey ? new Anthropic({ apiKey }) : null;

  // Default generator: one Messages API call with a constrained JSON schema.
  async function callClaude(front, language) {
    const lang = String(language || "").trim() || "the target language";
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: CARD_SCHEMA } },
      // Cap the input too: card fronts are sentences, not documents.
      messages: [{ role: "user", content: `Target language: ${lang}\nSentence: ${String(front).slice(0, 500)}` }],
    });
    const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
    const parsed = JSON.parse(text);
    return { back: parsed.translation ?? "", notes: parsed.notes ?? "" };
  }

  const gen = generate || callClaude;

  return {
    enabled,
    model,
    maxTokens,
    // Returns { back, notes } or { error }.
    async enrich(front, language) {
      if (!enabled) return { error: "not-configured" };
      if (!String(front || "").trim()) return { error: "empty" };
      return gen(front, language);
    },
  };
}
