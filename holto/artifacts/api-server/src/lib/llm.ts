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
interface GenResult {
  text: string | null;
  diag: string; // "" on success; a short human-readable reason on failure
}

// Turn an HTTP status from an AI provider into a plain-English, actionable reason.
function describeHttp(status: number, provider: string): string {
  switch (status) {
    case 429:
      return "the AI is rate-limited (free-tier quota reached) — wait a minute and try again, or enable billing on the API key for higher limits";
    case 400:
      return `${provider} rejected the request (check the API key is valid)`;
    case 401:
    case 403:
      return `the ${provider} API key is invalid or not authorised for this model`;
    case 404:
      return `the AI model isn't available (check the model name / GEMINI_MODEL)`;
    default:
      return status >= 500 ? `the ${provider} service had an error — try again shortly` : `${provider} HTTP ${status}`;
  }
}

async function geminiGenerate(
  parts: unknown[],
  opts: { json: boolean; maxTokens: number; temperature: number; timeoutMs?: number },
): Promise<GenResult> {
  if (!GEMINI_KEY) return { text: null, diag: "Gemini key not set" };
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
      return { text: null, diag: describeHttp(res.status, "Gemini") };
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text === "string" && text.trim()) return { text: text.trim(), diag: "" };
    const finish = json.candidates?.[0]?.finishReason;
    return { text: null, diag: `Gemini returned no text${finish ? ` (${finish})` : ""}` };
  } catch (err) {
    logger.warn({ err, model: GEMINI_MODEL }, "Gemini request failed");
    const name = err instanceof Error && err.name === "TimeoutError" ? "timed out" : "request failed";
    return { text: null, diag: `Gemini ${name}` };
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
  if (g.text) return g.text;

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

export interface DocResult {
  data: unknown | null;
  diag: string; // "" on success; a short human-readable reason on failure
}

// Free-first "read this document and give me JSON". Sends the file inline to
// Gemini's multimodal model (handles text-based and scanned PDFs, plus photos of
// a booking) with no PDF-parsing dependency; falls back to OpenAI (which now
// accepts PDFs and images). Returns the parsed data plus a diagnostic string so
// callers can tell the user *why* a read failed.
export async function generateJsonFromDocument(
  prompt: string,
  file: { data: string; mimeType: string },
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<DocResult> {
  const maxTokens = opts.maxTokens ?? 2048;
  const temperature = opts.temperature ?? 0;
  const diags: string[] = [];

  const g = await geminiGenerate(
    [{ text: prompt }, { inline_data: { mime_type: file.mimeType, data: file.data } }],
    { json: true, maxTokens, temperature, timeoutMs: 40000 },
  );
  if (g.text) {
    const parsed = parseJsonLoose(g.text);
    if (parsed !== null) return { data: parsed, diag: "" };
    diags.push("Gemini reply wasn't valid JSON");
  } else if (g.diag) {
    diags.push(g.diag);
  }

  if (openai) {
    try {
      const isImage = file.mimeType.startsWith("image/");
      // OpenAI accepts images via image_url and PDFs via a file content part.
      const filePart = isImage
        ? { type: "image_url", image_url: { url: `data:${file.mimeType};base64,${file.data}` } }
        : { type: "file", file: { filename: "booking.pdf", file_data: `data:${file.mimeType};base64,${file.data}` } };
      const r = await openai.chat.completions.create(
        {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: [{ type: "text", text: prompt }, filePart] as never }],
          response_format: { type: "json_object" },
          temperature,
          max_tokens: maxTokens,
        },
        { timeout: 40000, maxRetries: 1 },
      );
      const content = r.choices[0]?.message?.content;
      if (content) {
        const parsed = parseJsonLoose(content);
        if (parsed !== null) return { data: parsed, diag: "" };
      }
      diags.push("OpenAI returned nothing usable");
    } catch (err) {
      logger.warn({ err }, "OpenAI generateJsonFromDocument failed");
      diags.push(`OpenAI ${err instanceof Error ? err.message.slice(0, 60) : "error"}`);
    }
  }

  return { data: null, diag: diags.join("; ") || "no AI provider configured" };
}

export async function generateJson(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<unknown | null> {
  const maxTokens = opts.maxTokens ?? 900;
  const temperature = opts.temperature ?? 0;

  const g = await geminiGenerate([{ text: prompt }], { json: true, maxTokens, temperature, timeoutMs: 20000 });
  if (g.text) {
    const parsed = parseJsonLoose(g.text);
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
