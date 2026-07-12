import { logger } from "./logger";

// Live travel-advisory levels from travel-advisory.info — a free, key-less
// aggregator of multiple governments' advisories. Cached per country for 12h.
// Returns null on any failure so callers degrade gracefully (no banner shown).

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, { data: Advisory | null; ts: number }>();

export type AdvisoryLevel = "low" | "moderate" | "high" | "extreme";

export interface Advisory {
  code: string;
  name: string | null;
  score: number; // 0–5
  level: AdvisoryLevel;
  label: string;
  message: string | null;
  source: string | null;
  updated: string | null;
}

// travel-advisory.info scores run 0 (safe) → 5 (avoid). Bucket into the same
// four bands governments use.
function toLevel(score: number): { level: AdvisoryLevel; label: string } {
  if (score <= 2.5) return { level: "low", label: "Exercise normal precautions" };
  if (score <= 3.5) return { level: "moderate", label: "Exercise increased caution" };
  if (score <= 4.5) return { level: "high", label: "Reconsider travel" };
  return { level: "extreme", label: "Avoid all travel" };
}

export async function getAdvisory(codeRaw: string): Promise<Advisory | null> {
  const code = codeRaw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;

  const hit = cache.get(code);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  try {
    const res = await fetch(`https://www.travel-advisory.info/api?countrycode=${code}`, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`advisory HTTP ${res.status}`);
    const json = (await res.json()) as {
      data?: Record<string, { name?: string; advisory?: { score?: number; message?: string; updated?: string; source?: string } }>;
    };
    const entry = json.data?.[code];
    const adv = entry?.advisory;
    if (!adv || typeof adv.score !== "number") {
      cache.set(code, { data: null, ts: Date.now() });
      return null;
    }
    const { level, label } = toLevel(adv.score);
    const data: Advisory = {
      code,
      name: entry?.name ?? null,
      score: Math.round(adv.score * 10) / 10,
      level,
      label,
      message: adv.message?.trim() || null,
      source: adv.source?.trim() || null,
      updated: adv.updated ?? null,
    };
    cache.set(code, { data, ts: Date.now() });
    return data;
  } catch (err) {
    logger.warn({ err, code }, "advisory fetch failed");
    cache.set(code, { data: null, ts: Date.now() });
    return null;
  }
}
