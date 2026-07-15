// Safety override for the travel-alerts tool. The free advisory aggregator can
// lag badly on fast-moving conflicts (it once reported Israel as low-risk), and
// for a SAFETY feature that is the worst possible failure. This curated list of
// countries under a serious, country-wide (or majority) government travel
// warning lets us guarantee the tool fails toward caution: it can only ever
// RAISE an advisory level, never lower it.
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
