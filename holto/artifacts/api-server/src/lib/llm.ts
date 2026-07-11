import OpenAI from "openai";

import { logger } from "./logger";

// Provider-agnostic "give me JSON" helper. Prefers Google Gemini's free tier
// (no billing account required); falls back to OpenAI only if that key is the
// one configured. Returns parsed JSON or null — never throws — so callers can
// degrade gracefully (e.g. to manual entry).

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

export function llmConfigured(): boolean {
  return Boolean(GEMINI_KEY || OPENAI_KEY);
}

export async function generateJson(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<unknown | null> {
  const maxTokens = opts.maxTokens ?? 900;
  const temperature = opts.temperature ?? 0;

  // 1) Gemini free tier.
  if (GEMINI_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature, maxOutputTokens: maxTokens },
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === "string" && text.trim()) return JSON.parse(text);
    } catch (err) {
      logger.warn({ err }, "Gemini generateJson failed");
    }
  }

  // 2) OpenAI fallback (only if that's the configured key).
  if (openai) {
    try {
      const r = await openai.chat.completions.create(
        {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature,
          max_tokens: maxTokens,
        },
        { timeout: 15000, maxRetries: 1 },
      );
      const content = r.choices[0]?.message?.content;
      if (content) return JSON.parse(content);
    } catch (err) {
      logger.warn({ err }, "OpenAI generateJson failed");
    }
  }

  return null;
}
