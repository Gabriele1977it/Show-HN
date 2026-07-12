// Deterministic Schengen 90/180 calculation — the rule that matters most to
// digital nomads and frequent visitors: no more than 90 days of presence in the
// Schengen area within any rolling 180-day window. Unlike the tax-residency
// calc this is area-wide (not per country) and uses a 180-day look-back.
//
// Guidance, not legal advice: we count arrival and departure days inclusively
// (the conservative reading border officers use) and treat an open stay as
// "still there" up to today.

import type { Stay } from "./residency";

// Schengen area member states (ISO-3166 alpha-2), incl. Croatia (2023) and
// Bulgaria & Romania (full membership from 2025).
export const SCHENGEN_CODES = new Set([
  "AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS",
  "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI",
  "ES", "SE", "CH",
]);

export const WINDOW_DAYS = 180;
export const MAX_DAYS = 90;
const WARN_WITHIN = 15; // flag "approaching" when this many days or fewer remain
const MS_PER_DAY = 86_400_000;

function dayIndex(iso: string): number {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? NaN : Math.floor(t / MS_PER_DAY);
}
function isoFromIndex(idx: number): string {
  return new Date(idx * MS_PER_DAY).toISOString().slice(0, 10);
}
function overlap(a: number, b: number, w0: number, w1: number): number {
  const s = Math.max(a, w0);
  const e = Math.min(b, w1);
  return e < s ? 0 : e - s + 1;
}
function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((x, y) => x[0] - y[0]);
  const merged: Array<[number, number]> = [[sorted[0]![0], sorted[0]![1]]];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (cur[0] <= last[1] + 1) last[1] = Math.max(last[1], cur[1]);
    else merged.push([cur[0], cur[1]]);
  }
  return merged;
}
function usedInWindow(merged: Array<[number, number]>, w0: number, w1: number): number {
  let total = 0;
  for (const [a, b] of merged) total += overlap(a, b, w0, w1);
  return total;
}

export type SchengenStatusLevel = "safe" | "approaching" | "over";

export interface SchengenStatus {
  applicable: boolean; // the traveller has at least one Schengen stay on record
  daysUsed: number; // presence days in the last 180 (incl. today)
  daysRemaining: number; // 90 − used, floored at 0
  windowStart: string; // ISO — start of the current rolling window
  windowEnd: string; // ISO — today
  currentlyIn: boolean; // present in Schengen today
  mustLeaveBy: string | null; // ISO — last day you can stay on current continuous presence
  status: SchengenStatusLevel;
}

export function computeSchengen(stays: Stay[], today: string): SchengenStatus {
  const todayIdx = dayIndex(today);
  const windowStartIdx = todayIdx - (WINDOW_DAYS - 1);

  const upToToday: Array<[number, number]> = [];
  const beforeToday: Array<[number, number]> = [];
  for (const s of stays) {
    if (!SCHENGEN_CODES.has(s.countryCode.toUpperCase())) continue;
    const a = dayIndex(s.arrivalDate);
    if (Number.isNaN(a)) continue;
    let b = s.departureDate ? dayIndex(s.departureDate) : todayIdx;
    if (Number.isNaN(b) || b < a) continue;
    upToToday.push([a, Math.min(b, todayIdx)]);
    if (a <= todayIdx - 1) beforeToday.push([a, Math.min(b, todayIdx - 1)]);
  }

  const applicable = upToToday.length > 0;
  const merged = mergeIntervals(upToToday);
  const mergedBefore = mergeIntervals(beforeToday);

  const daysUsed = usedInWindow(merged, windowStartIdx, todayIdx);
  const daysRemaining = Math.max(0, MAX_DAYS - daysUsed);
  const currentlyIn = merged.some(([a, b]) => a <= todayIdx && todayIdx <= b);

  const status: SchengenStatusLevel = daysUsed > MAX_DAYS ? "over" : daysRemaining <= WARN_WITHIN ? "approaching" : "safe";

  // If they're in Schengen now, find the last day they could stay assuming
  // continuous presence from today — the practical "leave by" date.
  let mustLeaveBy: string | null = null;
  if (currentlyIn) {
    let last = todayIdx - 1; // means "already over — leave now"
    for (let d = todayIdx; d <= todayIdx + WINDOW_DAYS; d++) {
      const past = usedInWindow(mergedBefore, d - (WINDOW_DAYS - 1), d);
      const assumed = overlap(todayIdx, d, d - (WINDOW_DAYS - 1), d);
      if (past + assumed <= MAX_DAYS) last = d;
      else break;
    }
    mustLeaveBy = isoFromIndex(Math.max(last, todayIdx));
  }

  return {
    applicable,
    daysUsed,
    daysRemaining,
    windowStart: isoFromIndex(windowStartIdx),
    windowEnd: isoFromIndex(todayIdx),
    currentlyIn,
    mustLeaveBy,
    status,
  };
}
