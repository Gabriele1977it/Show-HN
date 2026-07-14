import OpenAI from "openai";

import { logger } from "./logger";

// Provider-agnostic LLM helpers. Prefers Google Gemini's free tier (no billing
// account required); falls back to OpenAI only if that key is configured.
// Everything returns null on failure — never throws — so callers can degrade
// gracefully (e.g. to manual entry).

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

// Try a chain of known-good models rather than betting on one name: model
// availability varies by key/project/region, and a single alias can 404. An
// optional GEMINI_MODEL env is tried first, then current GA fallbacks. On a
// 404 (model-not-found) we advance to the next; other errors stop the chain.
const GEMINI_MODELS: string[] = (() => {
  const fallbacks = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-1.5-flash"];
  const configured = process.env.GEMINI_MODEL?.trim();
  return configured ? [configured, ...fallbacks.filter((m) => m !== configured)] : fallbacks;
})();

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Attempt =
  | { kind: "ok"; text: string }
  | { kind: "notfound"; diag: string } // 404 — try the next model
  | { kind: "throttled"; diag: string } // 429/503 — retryable
  | { kind: "fail"; diag: string }; // other error / empty — stop

// A single Gemini generateContent call against one model.
async function geminiCall(
  model: string,
  body: string,
  timeoutMs: number,
): Promise<Attempt> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        // Key in a header, not the URL query — query strings leak into logs.
        headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (res.status === 404) {
      logger.warn({ model }, "Gemini model not found — trying next");
      return { kind: "notfound", diag: describeHttp(404, "Gemini") };
    }
    if (res.status === 429 || res.status === 503) {
      logger.warn({ status: res.status, model }, "Gemini throttled");
      return { kind: "throttled", diag: describeHttp(res.status, "Gemini") };
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logger.warn({ status: res.status, model, body: errBody.slice(0, 600) }, "Gemini HTTP error");
      return { kind: "fail", diag: describeHttp(res.status, "Gemini") };
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    };
    // Concatenate every text part — Gemini can split a reply across multiple
    // parts, and reading only parts[0] silently drops the rest of the answer.
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("").trim();
    if (text) return { kind: "ok", text };
    const finish = json.candidates?.[0]?.finishReason;
    return { kind: "fail", diag: `Gemini returned no text${finish ? ` (${finish})` : ""}` };
  } catch (err) {
    logger.warn({ err, model }, "Gemini request failed");
    const name = err instanceof Error && err.name === "TimeoutError" ? "timed out" : "request failed";
    return { kind: "fail", diag: `Gemini ${name}` };
  }
}

async function geminiGenerate(
  parts: unknown[],
  opts: { json: boolean; maxTokens: number; temperature: number; timeoutMs?: number },
): Promise<GenResult> {
  if (!GEMINI_KEY) return { text: null, diag: "Gemini key not set" };

  const timeoutMs = opts.timeoutMs ?? 20000;

  let lastDiag = "Gemini unavailable";
  for (const model of GEMINI_MODELS) {
    const generationConfig: Record<string, unknown> = {
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
      temperature: opts.temperature,
      maxOutputTokens: opts.maxTokens,
    };
    // 2.5 models "think" by default, which eats the output-token budget and can
    // truncate the JSON. Turn it off for our structured extraction so the whole
    // budget goes to the answer. (Only 2.5 accepts this field.)
    if (model.includes("2.5")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    const body = JSON.stringify({ contents: [{ parts }], generationConfig });

    let res = await geminiCall(model, body, timeoutMs);
    // A transient throttle self-heals: pause and retry the same model once.
    if (res.kind === "throttled") {
      await sleep(2500);
      res = await geminiCall(model, body, timeoutMs);
    }
    if (res.kind === "ok") return { text: res.text, diag: "" };
    lastDiag = res.diag;
    if (res.kind === "notfound") continue; // this model isn't available — try the next
    return { text: null, diag: res.diag }; // throttled/fail — don't cycle models
  }
  return { text: null, diag: lastDiag };
}

// Find the first balanced JSON object/array in a string, respecting strings and
// escapes. Salvages JSON that has prose around it or a trailing truncation.
function extractFirstJson(text: string): string | null {
  const startObj = text.indexOf("{");
  const startArr = text.indexOf("[");
  let i = startObj === -1 ? startArr : startArr === -1 ? startObj : Math.min(startObj, startArr);
  if (i === -1) return null;
  const open = text[i]!;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  for (; i < text.length; i++) {
    const c = text[i]!;
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return text.slice(text.indexOf(open), i + 1);
    }
  }
  return null;
}

// Parse JSON that may arrive wrapped in ```json fences or with stray prose
// despite our asking for a raw JSON mime type. Returns null if unparseable.
function parseJsonLoose(text: string): unknown | null {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* fall through to salvage */
  }
  const extracted = extractFirstJson(cleaned);
  if (extracted) {
    try {
      return JSON.parse(extracted);
    } catch {
      /* give up */
    }
  }
  return null;
}

// Free-first plain-text generation (prefers Gemini). Returns null on failure.
export async function generateText(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  const maxTokens = opts.maxTokens ?? 300;
  const temperature = opts.temperature ?? 0.4;

  const g = await geminiGenerate([{ text: prompt }], { json: false, maxTokens, temperature, timeoutMs: opts.timeoutMs ?? 15000 });
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
  const maxTokens = opts.maxTokens ?? 8192;
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
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<unknown | null> {
  const maxTokens = opts.maxTokens ?? 900;
  const temperature = opts.temperature ?? 0;

  const g = await geminiGenerate([{ text: prompt }], { json: true, maxTokens, temperature, timeoutMs: opts.timeoutMs ?? 20000 });
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
