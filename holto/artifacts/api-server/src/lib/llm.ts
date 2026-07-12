import OpenAI from "openai";

import { logger } from "./logger";

// Provider-agnostic LLM helpers. Prefers Google Gemini's free tier (no billing
// account required); falls back to OpenAI only if that key is configured.
// Everything returns null on failure — never throws — so callers can degrade
// gracefully (e.g. to manual entry).

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

// Configurable so we can move off a deprecated model without a code change.
// gemini-2.0-flash is current, free-tier, and supports text + vision (PDF/image).
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

export function llmConfigured(): boolean {
  return Boolean(GEMINI_KEY || OPENAI_KEY);
}

// One place that talks to Gemini. `parts` may include text and inline_data
// (for documents/images). Returns the raw model text or null, logging the HTTP
// status + body on failure so problems (e.g. a retired model) are diagnosable.
async function geminiGenerate(
  parts: unknown[],
  opts: { json: boolean; maxTokens: number; temperature: number; timeoutMs?: number },
): Promise<string | null> {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            ...(opts.json ? { responseMimeType: "application/json" } : {}),
            temperature: opts.temperature,
            maxOutputTokens: opts.maxTokens,
          },
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 20000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, model: GEMINI_MODEL, body: body.slice(0, 600) }, "Gemini HTTP error");
      return null;
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch (err) {
    logger.warn({ err, model: GEMINI_MODEL }, "Gemini request failed");
    return null;
  }
}

// Parse JSON that may arrive wrapped in ```json fences despite our asking for a
// raw JSON mime type — some models still add them. Returns null if unparseable.
function parseJsonLoose(text: string): unknown | null {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// Free-first plain-text generation (prefers Gemini). Returns null on failure.
export async function generateText(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const maxTokens = opts.maxTokens ?? 300;
  const temperature = opts.temperature ?? 0.4;

  const g = await geminiGenerate([{ text: prompt }], { json: false, maxTokens, temperature, timeoutMs: 15000 });
  if (g) return g;

  if (openai) {
    try {
      const r = await openai.chat.completions.create(
        { model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature, max_tokens: maxTokens },
        { timeout: 15000, maxRetries: 1 },
      );
      const content = r.choices[0]?.message?.content;
      if (content) return content.trim();
    } catch (err) {
      logger.warn({ err }, "OpenAI generateText failed");
    }
  }
  return null;
}

// Free-first "read this document and give me JSON". Sends the file inline to
// Gemini's multimodal model (handles text-based and scanned PDFs, plus photos of
// a booking) with no PDF-parsing dependency. Falls back to OpenAI for images
// only (chat.completions can't take a PDF). Returns null on failure.
export async function generateJsonFromDocument(
  prompt: string,
  file: { data: string; mimeType: string },
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<unknown | null> {
  const maxTokens = opts.maxTokens ?? 2048;
  const temperature = opts.temperature ?? 0;

  const g = await geminiGenerate(
    [{ text: prompt }, { inline_data: { mime_type: file.mimeType, data: file.data } }],
    { json: true, maxTokens, temperature, timeoutMs: 40000 },
  );
  if (g) {
    const parsed = parseJsonLoose(g);
    if (parsed !== null) return parsed;
  }

  if (openai && file.mimeType.startsWith("image/")) {
    try {
      const r = await openai.chat.completions.create(
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${file.mimeType};base64,${file.data}` } },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature,
          max_tokens: maxTokens,
        },
        { timeout: 40000, maxRetries: 1 },
      );
      const content = r.choices[0]?.message?.content;
      if (content) return parseJsonLoose(content);
    } catch (err) {
      logger.warn({ err }, "OpenAI generateJsonFromDocument failed");
    }
  }
  return null;
}

export async function generateJson(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<unknown | null> {
  const maxTokens = opts.maxTokens ?? 900;
  const temperature = opts.temperature ?? 0;

  const g = await geminiGenerate([{ text: prompt }], { json: true, maxTokens, temperature, timeoutMs: 20000 });
  if (g) {
    const parsed = parseJsonLoose(g);
    if (parsed !== null) return parsed;
  }

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
      if (content) return parseJsonLoose(content);
    } catch (err) {
      logger.warn({ err }, "OpenAI generateJson failed");
    }
  }
  return null;
}
