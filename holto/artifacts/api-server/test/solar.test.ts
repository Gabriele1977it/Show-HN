import assert from "node:assert/strict";
import { test } from "node:test";

import { computeLightWindows, sunEventUtcMin, ZENITH_OFFICIAL } from "../src/lib/solar.ts";

// Allow a few minutes of slack — the almanac algorithm is accurate to ~1-2 min.
function near(actual: number | null, expected: number, tol = 12) {
  assert.ok(actual != null, "expected a time, got null");
  assert.ok(Math.abs(actual! - expected) <= tol, `expected ~${expected} min, got ${actual}`);
}

test("London summer-solstice sunrise ≈ 03:43 UTC", () => {
  // 2026-06-21, lat 51.5074, lng -0.1278. Sunrise ~03:43 UTC → 223 min.
  const t = sunEventUtcMin(2026, 6, 21, 51.5074, -0.1278, ZENITH_OFFICIAL, true);
  near(t, 223);
});

test("London summer-solstice sunset ≈ 20:21 UTC", () => {
  const t = sunEventUtcMin(2026, 6, 21, 51.5074, -0.1278, ZENITH_OFFICIAL, false);
  near(t, 1221);
});

test("golden hour follows sunrise and precedes sunset", () => {
  const w = computeLightWindows(2026, 6, 21, 51.5074, -0.1278, );
  assert.ok(w.goldenMorning && w.sunriseUtcMin != null);
  // Morning golden hour starts at sunrise and ends a bit later.
  assert.equal(w.goldenMorning!.start, w.sunriseUtcMin);
  assert.ok(w.goldenMorning!.end > w.goldenMorning!.start);
  // Evening golden hour ends at sunset and starts a bit earlier.
  assert.equal(w.goldenEvening!.end, w.sunsetUtcMin);
  assert.ok(w.goldenEvening!.start < w.goldenEvening!.end);
});

test("blue hour brackets the day: morning before sunrise, evening after sunset", () => {
  const w = computeLightWindows(2026, 6, 21, 51.5074, -0.1278);
  assert.ok(w.blueMorning!.end === w.sunriseUtcMin);
  assert.ok(w.blueMorning!.start < w.blueMorning!.end);
  assert.ok(w.blueEvening!.start === w.sunsetUtcMin);
  assert.ok(w.blueEvening!.end > w.blueEvening!.start);
});

test("polar day: Tromsø in late June — sun never sets", () => {
  const w = computeLightWindows(2026, 6, 21, 69.6492, 18.9553);
  assert.equal(w.polar, true);
  assert.equal(w.sunsetUtcMin, null);
});

test("equator equinox: roughly 12 hours of daylight", () => {
  const sunrise = sunEventUtcMin(2026, 3, 20, 0, 0, ZENITH_OFFICIAL, true);
  const sunset = sunEventUtcMin(2026, 3, 20, 0, 0, ZENITH_OFFICIAL, false);
  assert.ok(sunrise != null && sunset != null);
  const daylight = sunset! - sunrise!;
  assert.ok(Math.abs(daylight - 720) <= 20, `expected ~720 min daylight, got ${daylight}`);
});
