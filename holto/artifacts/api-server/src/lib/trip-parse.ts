import { generateJson } from "./llm";

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

export async function parseTripFromText(text: string): Promise<ParsedTrip | null> {
  const trimmed = text.trim();
  if (trimmed.length < 15) return null;

  const prompt = `You extract travel bookings from pasted confirmation text (emails, receipts).
Return ONLY the bookings that are explicitly present — never invent flights, hotels, dates, times or references.

Booking text:
"""
${trimmed.slice(0, 6000)}
"""

Respond ONLY with valid JSON, no markdown:
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
If there are no real bookings in the text, return {"title":"","destination":null,"startDate":null,"endDate":null,"items":[]}.`;

  const parsed = await generateJson(prompt, { maxTokens: 900, temperature: 0 });
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

  const title = str(raw.title) ?? str(raw.destination) ?? "New trip";
  return {
    title,
    destination: str(raw.destination),
    startDate: cleanDate(raw.startDate),
    endDate: cleanDate(raw.endDate),
    items,
  };
}
