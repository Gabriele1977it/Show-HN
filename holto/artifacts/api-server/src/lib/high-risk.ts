// Curated BACKSTOP for the travel-alerts safety override. The primary source is
// now automated and self-updating — the live US State Department advisory feed
// (see lib/statedept.ts) — so this list normally isn't even consulted. It exists
// only as a fallback for when that feed is unreachable, guaranteeing the big
// conflict zones still fail toward caution. Like the feed, it can only ever
// RAISE an advisory level, never lower it. Because it's a backstop, it needs far
// less upkeep, but a periodic glance is still worthwhile.
//
// Deliberately conservative about scope: countries where only a specific region
// is affected (e.g. Egypt/Sinai, Mexico/certain states, Türkiye's border) are
// NOT listed here, so we don't wrongly scare travellers off popular, mostly-safe
// destinations — the official advice link covers regional detail.
//
// MUST be reviewed periodically. Bump HIGH_RISK_REVIEWED when you do.

export type RiskLevel = "high" | "extreme";

export const HIGH_RISK_REVIEWED = "2026-07";

// "extreme" ≈ government advises against ALL travel (do not travel).
// "high" ≈ advises against all-but-essential travel / reconsider travel.
export const HIGH_RISK: Record<string, RiskLevel> = {
  AF: "extreme", // Afghanistan
  SY: "extreme", // Syria
  YE: "extreme", // Yemen
  SO: "extreme", // Somalia
  SS: "extreme", // South Sudan
  LY: "extreme", // Libya
  ML: "extreme", // Mali
  SD: "extreme", // Sudan
  CF: "extreme", // Central African Republic
  BF: "extreme", // Burkina Faso
  NE: "extreme", // Niger
  HT: "extreme", // Haiti
  IR: "extreme", // Iran
  UA: "extreme", // Ukraine
  PS: "extreme", // Palestinian Territories (incl. Gaza)
  IQ: "high", // Iraq
  LB: "high", // Lebanon
  IL: "high", // Israel
  RU: "high", // Russia
  BY: "high", // Belarus
  VE: "high", // Venezuela
  MM: "high", // Myanmar
};

export function highRiskLevel(code: string): RiskLevel | null {
  return HIGH_RISK[code.trim().toUpperCase()] ?? null;
}
