import { logger } from "./logger";
import { HIGH_RISK_REVIEWED, highRiskLevel, type RiskLevel } from "./high-risk";

// Live travel-advisory levels from travel-advisory.info — a free, key-less
// aggregator of multiple governments' advisories. Cached per country.
//
// The aggregator can lag on fast-moving conflicts, so its level is passed
// through a safety override (lib/high-risk.ts) that can only RAISE the level,
// never lower it — the tool must fail toward caution. When the aggregator has no
// data for a listed high-risk country, we still return an elevated advisory.
// Returns null only when there is genuinely nothing to show.

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // fresher than before, for safety
const cache = new Map<string, { data: Advisory | null; ts: number }>();

export type AdvisoryLevel = "low" | "moderate" | "high" | "extreme";

const LEVEL_ORDER: Record<AdvisoryLevel, number> = { low: 0, moderate: 1, high: 2, extreme: 3 };

export interface Advisory {
  code: string;
  name: string | null;
  score: number; // 0–5
  level: AdvisoryLevel;
  label: string;
  message: string | null;
  source: string | null;
  updated: string | null;
  elevated?: boolean; // true when our safety override raised the level
}

const LABELS: Record<AdvisoryLevel, string> = {
  low: "Exercise normal precautions",
  moderate: "Exercise increased caution",
  high: "Reconsider travel",
  extreme: "Avoid all travel",
};

// travel-advisory.info scores run 0 (safe) → 5 (avoid). Bucket into the same
// four bands governments use.
function toLevel(score: number): { level: AdvisoryLevel; label: string } {
  if (score <= 2.5) return { level: "low", label: LABELS.low };
  if (score <= 3.5) return { level: "moderate", label: LABELS.moderate };
  if (score <= 4.5) return { level: "high", label: LABELS.high };
  return { level: "extreme", label: LABELS.extreme };
}

// Nominal score used when the override synthesises/raises a level.
function scoreForLevel(level: AdvisoryLevel): number {
  return { low: 2, moderate: 3, high: 4, extreme: 5 }[level];
}

// Apply the high-risk override: never lower a level, only raise it. When the
// aggregator returned nothing but the country is on the list, synthesise one.
export function applyOverride(code: string, base: Advisory | null): Advisory | null {
  const risk: RiskLevel | null = highRiskLevel(code);
  if (!risk) return base;

  if (!base) {
    return {
      code,
      name: null,
      score: scoreForLevel(risk),
      level: risk,
      label: LABELS[risk],
      message:
        "A serious government travel warning currently applies to all or part of this country. Read the official advice below before you travel.",
      source: `HOLTO safety review (${HIGH_RISK_REVIEWED})`,
      updated: HIGH_RISK_REVIEWED,
      elevated: true,
    };
  }

  if (LEVEL_ORDER[risk] > LEVEL_ORDER[base.level]) {
    return {
      ...base,
      level: risk,
      label: LABELS[risk],
      score: Math.max(base.score, scoreForLevel(risk)),
      message:
        base.message ??
        "A serious government travel warning currently applies to all or part of this country. Read the official advice below.",
      elevated: true,
    };
  }
  return base;
}

export async function getAdvisory(codeRaw: string): Promise<Advisory | null> {
  const code = codeRaw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;

  const hit = cache.get(code);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  let base: Advisory | null = null;
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
    if (adv && typeof adv.score === "number") {
      const { level, label } = toLevel(adv.score);
      base = {
        code,
        name: entry?.name ?? null,
        score: Math.round(adv.score * 10) / 10,
        level,
        label,
        message: adv.message?.trim() || null,
        source: adv.source?.trim() || null,
        updated: adv.updated ?? null,
      };
    }
  } catch (err) {
    logger.warn({ err, code }, "advisory fetch failed");
  }

  const data = applyOverride(code, base);
  cache.set(code, { data, ts: Date.now() });
  return data;
}
