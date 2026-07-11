import assert from "node:assert/strict";
import { test } from "node:test";

import { computeResidency, type Stay } from "../src/lib/residency.ts";

const REF = "2026-07-11"; // reference "today" for deterministic tests

test("counts arrival and departure days inclusively", () => {
  const stays: Stay[] = [
    { countryCode: "PT", countryName: "Portugal", arrivalDate: "2026-07-01", departureDate: "2026-07-10" },
  ];
  const [r] = computeResidency(stays, REF);
  assert.equal(r.totalDays, 10); // 1st..10th inclusive
  assert.equal(r.daysThisYear, 10);
});

test("open stay counts up to today, not beyond", () => {
  const stays: Stay[] = [
    { countryCode: "TH", countryName: "Thailand", arrivalDate: "2026-07-01", departureDate: null },
  ];
  const [r] = computeResidency(stays, REF);
  assert.equal(r.totalDays, 11); // Jul 1..Jul 11
});

test("threshold status: safe / approaching / over", () => {
  const safe = computeResidency(
    [{ countryCode: "ES", countryName: "Spain", arrivalDate: "2026-01-01", departureDate: "2026-02-09" }],
    REF,
  )[0];
  assert.equal(safe.status, "safe"); // 40 days

  const approaching = computeResidency(
    [{ countryCode: "ES", countryName: "Spain", arrivalDate: "2026-01-01", departureDate: "2026-06-14" }],
    REF,
  )[0];
  // Jan1..Jun14 = 165 days → within 30 of 183
  assert.equal(approaching.status, "approaching");
  assert.equal(approaching.daysUntilThreshold, 183 - 165);

  const over = computeResidency(
    [{ countryCode: "ES", countryName: "Spain", arrivalDate: "2026-01-01", departureDate: "2026-07-05" }],
    REF,
  )[0];
  // Jan1..Jul5 = 186 days
  assert.equal(over.status, "over");
  assert.equal(over.daysUntilThreshold, 0);
});

test("overlapping stays in the same country are not double-counted", () => {
  const stays: Stay[] = [
    { countryCode: "FR", countryName: "France", arrivalDate: "2026-03-01", departureDate: "2026-03-20" },
    { countryCode: "FR", countryName: "France", arrivalDate: "2026-03-15", departureDate: "2026-03-31" },
  ];
  const [r] = computeResidency(stays, REF);
  assert.equal(r.totalDays, 31); // Mar 1..31 merged, not 20 + 17
});

test("rolling 12-month window clips a stay that began over a year ago", () => {
  const stays: Stay[] = [
    // Started ~13 months before REF; only the last 365 days count in rolling.
    { countryCode: "AE", countryName: "United Arab Emirates", arrivalDate: "2025-06-01", departureDate: "2026-07-11" },
  ];
  const [r] = computeResidency(stays, REF);
  assert.equal(r.daysRolling12m, 365); // full rolling window
  assert.ok(r.totalDays > 365);
  assert.equal(r.daysThisYear, dayCount("2026-01-01", "2026-07-11"));
});

test("future and malformed stays are ignored", () => {
  const stays: Stay[] = [
    { countryCode: "JP", countryName: "Japan", arrivalDate: "2027-01-01", departureDate: "2027-02-01" }, // future
    { countryCode: "JP", countryName: "Japan", arrivalDate: "2026-05-10", departureDate: "2026-05-01" }, // reversed
    { countryCode: "JP", countryName: "Japan", arrivalDate: "not-a-date" },
  ];
  assert.equal(computeResidency(stays, REF).length, 0);
});

test("multiple countries are returned sorted by days this year", () => {
  const stays: Stay[] = [
    { countryCode: "PT", countryName: "Portugal", arrivalDate: "2026-06-01", departureDate: "2026-06-10" }, // 10
    { countryCode: "GB", countryName: "United Kingdom", arrivalDate: "2026-01-01", departureDate: "2026-03-01" }, // 60
  ];
  const r = computeResidency(stays, REF);
  assert.equal(r[0].countryCode, "GB");
  assert.equal(r[1].countryCode, "PT");
});

// inclusive day count helper for assertions
function dayCount(a: string, b: string): number {
  const d = (s: string) => Math.floor(Date.parse(`${s}T00:00:00Z`) / 86_400_000);
  return d(b) - d(a) + 1;
}
