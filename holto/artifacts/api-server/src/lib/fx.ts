import { logger } from "./logger";

// Live foreign-exchange rates, base GBP, from a free key-less feed. Cached for
// a day. Returns units of each currency per 1 GBP. Returns {} on failure so
// callers can fall back gracefully.
const FX_URL = "https://open.er-api.com/v6/latest/GBP";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let cache: { rates: Record<string, number>; ts: number } | null = null;

// When the currently-cached rates were fetched (epoch ms), or null if none yet.
export function ratesFetchedAt(): number | null {
  return cache?.ts ?? null;
}

export async function getRatesPerGBP(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.rates;
  try {
    const res = await fetch(FX_URL);
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (json.result !== "success" || !json.rates || typeof json.rates !== "object") {
      throw new Error("FX malformed response");
    }
    cache = { rates: json.rates, ts: Date.now() };
    return json.rates;
  } catch (err) {
    logger.warn({ err }, "FX rate fetch failed");
    return {};
  }
}

// Convert an amount in `currency` to GBP using `rates` (units per GBP).
// Returns null when the currency isn't in the feed, so callers can show the
// original amount rather than a wrong conversion.
export function toGBP(amount: number, currency: string, rates: Record<string, number>): number | null {
  if (currency === "GBP") return amount;
  const rate = rates[currency];
  if (typeof rate !== "number" || rate <= 0) return null;
  return amount / rate;
}
