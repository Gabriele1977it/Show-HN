import { generateJson, generateJsonFromDocument } from "./llm";
import { extractPdfText } from "./pdf-text";
import { logger } from "./logger";

// Turn a pasted booking confirmation (flight, hotel, train, car…) into a
// structured trip. Uses an LLM purely as a parser — it extracts what's in the
// text and never invents bookings. Prefers the free Gemini tier (see lib/llm).
// Returns null on any failure so the caller can fall back to manual entry.

const ITEM_TYPES = new Set(["flight", "hotel", "train", "car", "activity", "other"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ParsedItem {
  type: string;
  title: string;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  reference: string | null;
}

export interface ParsedTrip {
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  items: ParsedItem[];
}

function cleanDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return ISO_DATE.test(v) ? v : null;
}

// Accept a full ISO datetime or a plain date; normalise a plain date to UTC
// midnight. Anything unparseable becomes null.
function cleanDateTime(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  if (ISO_DATE.test(v)) return `${v}T00:00:00Z`;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function str(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

// The JSON contract the model must return — shared by the text and document
// parsers so both produce the same shape.
const SCHEMA_INSTRUCTIONS = `Respond ONLY with valid JSON, no markdown:
{
  "title": "short trip name, e.g. 'Lisbon' or 'New York sales trip'",
  "destination": "City, Country or null",
  "startDate": "YYYY-MM-DD or null (earliest date across items)",
  "endDate": "YYYY-MM-DD or null (latest date)",
  "items": [
    {
      "type": "one of: flight, hotel, train, car, activity, other",
      "title": "e.g. 'BA503 LHR to LIS' or 'Hotel Lisboa'",
      "startAt": "YYYY-MM-DDTHH:MM:SSZ if a time is given, else YYYY-MM-DD, else null",
      "endAt": "same format or null (hotel check-out, flight arrival)",
      "location": "airport codes / city / address or null",
      "reference": "booking or confirmation number or null"
    }
  ]
}
If there are no real bookings, return {"title":"","destination":null,"startDate":null,"endDate":null,"items":[]}.`;

// Turn the model's raw JSON into a validated ParsedTrip, or null if it holds no
// usable booking. Shared by both the text and document parsers.
function finalizeParsedTrip(parsed: unknown): ParsedTrip | null {
  if (!parsed || typeof parsed !== "object") return null;
  const raw = parsed as Record<string, unknown>;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  const items: ParsedItem[] = [];
  for (const r of rawItems) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const title = str(o.title);
    if (!title) continue;
    const type = typeof o.type === "string" && ITEM_TYPES.has(o.type) ? o.type : "other";
    items.push({
      type,
      title,
      startAt: cleanDateTime(o.startAt),
      endAt: cleanDateTime(o.endAt),
      location: str(o.location),
      reference: str(o.reference, 60),
    });
  }

  if (items.length === 0) return null;

  return {
    title: str(raw.title) ?? str(raw.destination) ?? "New trip",
    destination: str(raw.destination),
    startDate: cleanDate(raw.startDate),
    endDate: cleanDate(raw.endDate),
    items,
  };
}

export async function parseTripFromText(text: string): Promise<ParsedTrip | null> {
  const trimmed = text.trim();
  if (trimmed.length < 15) return null;

  const prompt = `You extract travel bookings from pasted confirmation text (emails, receipts).
Return ONLY the bookings that are explicitly present — never invent flights, hotels, dates, times or references.

Booking text:
"""
${trimmed.slice(0, 6000)}
"""

${SCHEMA_INSTRUCTIONS}`;

  const parsed = await generateJson(prompt, { maxTokens: 900, temperature: 0 });
  return finalizeParsedTrip(parsed);
}

export interface DocParseResult {
  trip: ParsedTrip | null;
  diag: string; // "" on success; a short reason on failure (surfaced to the user)
}

// Parse an uploaded booking document (PDF or a photo/screenshot of a
// confirmation). The model reads the file directly — see generateJsonFromDocument.
export async function parseTripFromDocument(file: { data: string; mimeType: string }): Promise<DocParseResult> {
  const prompt = `This document is a travel booking confirmation (e.g. an airline, hotel, train or car-hire PDF or a photo of one).
Extract ONLY the bookings that are explicitly present — never invent flights, hotels, dates, times or references.

${SCHEMA_INSTRUCTIONS}`;

  const { data, diag } = await generateJsonFromDocument(prompt, file, { maxTokens: 8192, temperature: 0 });
  const fromVision = finalizeParsedTrip(data);
  if (fromVision) return { trip: fromVision, diag: "" };
  // The model replied but held no booking (vs. failing to read the file at all).
  const visionDiag = diag || (data !== null ? "no booking found in the document" : "the model couldn't read the file");

  // Fallback: if the vision model couldn't read the PDF (unsupported model,
  // odd inline handling, etc.), extract the embedded text and run it through
  // the proven text parser — a second path that doesn't depend on vision.
  if (file.mimeType === "application/pdf") {
    try {
      const text = extractPdfText(Buffer.from(file.data, "base64"));
      // Only worth a parse if we got real words, not glyph-index noise from a
      // custom-encoded font (common in airline/hotel PDFs, which then only the
      // vision model can read). Require both a floor and a healthy letter ratio
      // — a few dozen letters buried in 20k of glyph noise is not real text.
      const letters = (text.match(/[A-Za-z]/g) ?? []).length;
      const ratio = letters / Math.max(text.length, 1);
      if (letters >= 40 && ratio >= 0.05) {
        logger.info({ chars: text.length, letters }, "PDF vision empty — retrying via extracted text");
        const fromText = await parseTripFromText(text);
        if (fromText) return { trip: fromText, diag: "" };
        return { trip: null, diag: `${visionDiag}; PDF text had no booking` };
      }
      logger.warn({ chars: text.length, letters }, "PDF text extraction yielded no readable words (custom font?)");
      return { trip: null, diag: `${visionDiag}; PDF text isn't extractable (custom font)` };
    } catch (err) {
      logger.warn({ err }, "PDF text-extraction fallback failed");
    }
  }
  return { trip: null, diag: visionDiag };
}
