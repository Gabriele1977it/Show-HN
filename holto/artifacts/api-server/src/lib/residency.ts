// Deterministic days-in-country / tax-residency calculation.
//
// Given a set of stays, count the days a traveller was present in each country
// within two windows that tax authorities commonly use — the current calendar
// year and a rolling 12 months — and flag when a threshold (default the
// 183-day rule) is approaching or crossed. Pure and dependency-free so it can
// be unit-tested and reused by a background reminder worker later.
//
// NOTE: this is guidance, not tax advice — real residency rules vary by country
// (tie-breakers, tax-year start dates, part-day counting). We count arrival and
// departure days inclusively, the most conservative common interpretation.

export interface Stay {
  countryCode: string;
  countryName: string;
  arrivalDate: string; // "YYYY-MM-DD"
  departureDate?: string | null; // null/undefined = still there
}

export type ResidencyStatus = "safe" | "approaching" | "over";

export interface CountryResidency {
  countryCode: string;
  countryName: string;
  daysThisYear: number;
  daysRolling12m: number;
  totalDays: number;
  threshold: number;
  status: ResidencyStatus;
  daysUntilThreshold: number; // vs the worse of the two windows; 0 if over
}

const MS_PER_DAY = 86_400_000;
const DEFAULT_THRESHOLD = 183;
const WARN_WITHIN = 30; // flag "approaching" within this many days of the threshold

// Whole-day index (UTC) for a "YYYY-MM-DD" date. Returns NaN for bad input.
function dayIndex(iso: string): number {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? NaN : Math.floor(t / MS_PER_DAY);
}

// Inclusive-day overlap between [a,b] and window [w0,w1]; 0 if disjoint.
function overlapDays(a: number, b: number, w0: number, w1: number): number {
  const start = Math.max(a, w0);
  const end = Math.min(b, w1);
  return end < start ? 0 : end - start + 1;
}

// Merge overlapping/touching inclusive intervals so shared days aren't
// double-counted when stays overlap.
function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((x, y) => x[0] - y[0]);
  const merged: Array<[number, number]> = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (cur[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], cur[1]);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

export function computeResidency(
  stays: Stay[],
  referenceDate: string,
  threshold: number = DEFAULT_THRESHOLD,
): CountryResidency[] {
  const today = dayIndex(referenceDate);
  if (Number.isNaN(today)) return [];

  const yearStart = dayIndex(`${referenceDate.slice(0, 4)}-01-01`);
  const rollingStart = today - 364; // inclusive 365-day window ending today

  // Group valid stays (clipped to today) by country.
  const byCountry = new Map<string, { name: string; intervals: Array<[number, number]> }>();
  for (const s of stays) {
    const a = dayIndex(s.arrivalDate);
    if (Number.isNaN(a) || a > today) continue; // ignore future/invalid arrivals
    let b = s.departureDate ? dayIndex(s.departureDate) : today;
    if (Number.isNaN(b)) b = today;
    if (b > today) b = today; // don't count into the future
    if (b < a) continue; // malformed range

    const key = s.countryCode.toUpperCase();
    const entry = byCountry.get(key) ?? { name: s.countryName, intervals: [] };
    entry.intervals.push([a, b]);
    byCountry.set(key, entry);
  }

  const results: CountryResidency[] = [];
  for (const [code, { name, intervals }] of byCountry) {
    const merged = mergeIntervals(intervals);
    let daysThisYear = 0;
    let daysRolling12m = 0;
    let totalDays = 0;
    for (const [a, b] of merged) {
      daysThisYear += overlapDays(a, b, yearStart, today);
      daysRolling12m += overlapDays(a, b, rollingStart, today);
      totalDays += b - a + 1;
    }

    const worst = Math.max(daysThisYear, daysRolling12m);
    const daysUntilThreshold = Math.max(0, threshold - worst);
    const status: ResidencyStatus =
      worst >= threshold ? "over" : daysUntilThreshold <= WARN_WITHIN ? "approaching" : "safe";

    results.push({
      countryCode: code,
      countryName: name,
      daysThisYear,
      daysRolling12m,
      totalDays,
      threshold,
      status,
      daysUntilThreshold,
    });
  }

  // Most relevant (most days this year) first.
  results.sort((x, y) => y.daysThisYear - x.daysThisYear);
  return results;
}
