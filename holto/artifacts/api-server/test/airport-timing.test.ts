import assert from "node:assert/strict";
import { test } from "node:test";

import { computeLeaveTime, minutesUntil } from "../src/lib/airport-timing.ts";

test("international flight subtracts 3h buffer + drive", () => {
  const r = computeLeaveTime({ departureAt: "2026-07-11T18:00:00Z", driveMinutes: 45, tripType: "international" });
  assert.ok(r);
  assert.equal(r!.recommendedArrivalMinutes, 180);
  assert.equal(r!.arriveAirportBy, "2026-07-11T15:00:00.000Z"); // 18:00 - 3h
  assert.equal(r!.leaveBy, "2026-07-11T14:15:00.000Z"); // - 45m drive
  assert.equal(r!.totalLeadMinutes, 225);
});

test("domestic flight uses a 2h buffer", () => {
  const r = computeLeaveTime({ departureAt: "2026-07-11T09:00:00Z", driveMinutes: 30, tripType: "domestic" });
  assert.equal(r!.arriveAirportBy, "2026-07-11T07:00:00.000Z");
  assert.equal(r!.leaveBy, "2026-07-11T06:30:00.000Z");
});

test("negative or fractional drive time is clamped/rounded", () => {
  const r = computeLeaveTime({ departureAt: "2026-07-11T09:00:00Z", driveMinutes: -10, tripType: "domestic" });
  assert.equal(r!.driveMinutes, 0);
  assert.equal(r!.leaveBy, r!.arriveAirportBy);
});

test("invalid departure returns null", () => {
  assert.equal(computeLeaveTime({ departureAt: "nope", driveMinutes: 20, tripType: "domestic" }), null);
});

test("minutesUntil computes signed minutes", () => {
  assert.equal(minutesUntil("2026-07-11T12:30:00Z", "2026-07-11T12:00:00Z"), 30);
  assert.equal(minutesUntil("2026-07-11T11:00:00Z", "2026-07-11T12:00:00Z"), -60);
});
