import assert from "node:assert/strict";
import { test } from "node:test";

import { computeSchengen } from "../src/lib/schengen.ts";
import type { Stay } from "../src/lib/residency.ts";

const MS = 86_400_000;
function daysAgo(today: string, n: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - n * MS).toISOString().slice(0, 10);
}

test("no Schengen stays → not applicable, full allowance", () => {
  const s = computeSchengen([], "2026-07-11");
  assert.equal(s.applicable, false);
  assert.equal(s.daysUsed, 0);
  assert.equal(s.daysRemaining, 90);
  assert.equal(s.status, "safe");
});

test("non-Schengen stays are ignored", () => {
  const stays: Stay[] = [{ countryCode: "US", countryName: "United States", arrivalDate: "2026-06-01", departureDate: "2026-07-01" }];
  const s = computeSchengen(stays, "2026-07-11");
  assert.equal(s.applicable, false);
  assert.equal(s.daysUsed, 0);
});

test("a 30-day open stay: 30 used, 60 remaining, leave-by 60 days out", () => {
  const today = "2026-07-11";
  const stays: Stay[] = [{ countryCode: "PT", countryName: "Portugal", arrivalDate: daysAgo(today, 29), departureDate: null }];
  const s = computeSchengen(stays, today);
  assert.equal(s.daysUsed, 30); // inclusive of arrival + today
  assert.equal(s.daysRemaining, 60);
  assert.equal(s.currentlyIn, true);
  assert.equal(s.status, "safe");
  assert.equal(s.mustLeaveBy, daysAgo(today, -60)); // today + 60
});

test("approaching when 15 or fewer days remain", () => {
  const today = "2026-07-11";
  const stays: Stay[] = [{ countryCode: "ES", countryName: "Spain", arrivalDate: daysAgo(today, 79), departureDate: null }];
  const s = computeSchengen(stays, today); // 80 used → 10 remaining
  assert.equal(s.daysUsed, 80);
  assert.equal(s.daysRemaining, 10);
  assert.equal(s.status, "approaching");
});

test("over the limit → status over, 0 remaining", () => {
  const today = "2026-07-11";
  const stays: Stay[] = [{ countryCode: "FR", countryName: "France", arrivalDate: daysAgo(today, 99), departureDate: null }];
  const s = computeSchengen(stays, today); // 100 used
  assert.equal(s.daysUsed, 100);
  assert.equal(s.daysRemaining, 0);
  assert.equal(s.status, "over");
});

test("days outside the 180-day window don't count", () => {
  const today = "2026-07-11";
  const stays: Stay[] = [{ countryCode: "IT", countryName: "Italy", arrivalDate: daysAgo(today, 260), departureDate: daysAgo(today, 200) }];
  const s = computeSchengen(stays, today);
  assert.equal(s.applicable, true);
  assert.equal(s.daysUsed, 0);
  assert.equal(s.daysRemaining, 90);
  assert.equal(s.currentlyIn, false);
  assert.equal(s.mustLeaveBy, null);
});

test("multiple Schengen countries are summed area-wide without double-counting", () => {
  const today = "2026-07-11";
  const stays: Stay[] = [
    { countryCode: "PT", countryName: "Portugal", arrivalDate: daysAgo(today, 40), departureDate: daysAgo(today, 31) }, // 10 days
    { countryCode: "ES", countryName: "Spain", arrivalDate: daysAgo(today, 30), departureDate: daysAgo(today, 21) }, // 10 days
  ];
  const s = computeSchengen(stays, today);
  assert.equal(s.daysUsed, 20);
  assert.equal(s.daysRemaining, 70);
});
