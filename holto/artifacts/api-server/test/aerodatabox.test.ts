import assert from "node:assert/strict";
import { test } from "node:test";

import { normaliseAdbFlight } from "../src/lib/aerodatabox.ts";
import { deriveStatusAndDelay, mergeFlightRecords } from "../src/lib/flights.ts";
import { mapStatus } from "../src/lib/flight-format.ts";

test("normaliseAdbFlight maps status and parses the space-separated UTC times", () => {
  const r = normaliseAdbFlight({
    number: "EY 64",
    status: "Delayed",
    airline: { iata: "EY" },
    departure: {
      airport: { iata: "LHR" },
      scheduledTime: { utc: "2026-07-15 14:45Z" },
      revisedTime: { utc: "2026-07-15 17:10Z" },
      terminal: "4",
      gate: "10A",
    },
    arrival: { airport: { iata: "AUH" }, scheduledTime: { utc: "2026-07-16 00:45Z" } },
  });
  assert.equal(r.flight_iata, "EY64");
  assert.equal(r.status, "delayed");
  assert.equal(r.dep_iata, "LHR");
  assert.equal(r.dep_time, "2026-07-15T14:45:00.000Z");
  assert.equal(r.dep_estimated, "2026-07-15T17:10:00.000Z");
  assert.equal(r.dep_terminal, "4");
});

test("normaliseAdbFlight maps the status vocabulary", () => {
  assert.equal(normaliseAdbFlight({ status: "Canceled" }).status, "cancelled");
  assert.equal(normaliseAdbFlight({ status: "Departed" }).status, "active");
  assert.equal(normaliseAdbFlight({ status: "Arrived" }).status, "landed");
  assert.equal(normaliseAdbFlight({ status: "Expected" }).status, "scheduled");
});

test("mergeFlightRecords takes the more-disrupted status", () => {
  const airlabs = { status: "scheduled", dep_time: "2026-07-15T14:45:00Z" };
  const adb = { status: "delayed", dep_time: "2026-07-15T14:45:00Z", dep_estimated: "2026-07-15T17:10:00Z" };
  const merged = mergeFlightRecords(airlabs, adb)!;
  assert.equal(mapStatus(merged.status as string), "delayed");
  assert.equal(merged.dep_estimated, "2026-07-15T17:10:00Z"); // delay signal preserved
});

test("mergeFlightRecords surfaces the bigger real delay and its consistent times", () => {
  const a = { status: "scheduled", dep_time: "2026-07-15T14:45:00Z", dep_estimated: "2026-07-15T15:00:00Z" }; // 15m
  const b = { status: "scheduled", dep_time: "2026-07-15T14:45:00Z", dep_estimated: "2026-07-15T17:10:00Z" }; // 145m
  const merged = mergeFlightRecords(a, b)!;
  assert.equal(merged.dep_delay, 145);
  assert.equal(merged.dep_estimated, "2026-07-15T17:10:00Z");
});

test("merge doesn't invent a delay from local-vs-UTC time bases (the EY62 -60 bug)", () => {
  const airlabs = { status: "scheduled", dep_time: "2026-07-16 09:30" }; // local, no estimate
  const adb = { status: "scheduled", dep_time: "2026-07-16T08:30:00Z", dep_estimated: "2026-07-16T08:30:00Z" }; // UTC, on time
  const merged = mergeFlightRecords(airlabs, adb)!;
  assert.ok((merged.dep_delay as number) >= 0, "delay must never be negative");
  const d = deriveStatusAndDelay(merged);
  assert.equal(d.status, "scheduled");
  assert.equal(d.delay, null); // no phantom delay
});

test("mergeFlightRecords tolerates either side being null", () => {
  const only = { status: "delayed" };
  assert.deepEqual(mergeFlightRecords(only, null), only);
  assert.deepEqual(mergeFlightRecords(null, only), only);
  assert.equal(mergeFlightRecords(null, null), null);
});

import { localWindow, pickBestLeg } from "../src/lib/aerodatabox.ts";

test("localWindow builds a ±2h airport-local FIDS window", () => {
  const w = localWindow("2026-07-16 09:30+01:00")!;
  assert.equal(w.from, "2026-07-16T07:30");
  assert.equal(w.to, "2026-07-16T11:30");
  assert.equal(localWindow("nonsense"), null);
});

test("pickBestLeg prefers a leg that carries a revised (delay) time", () => {
  const legs = [
    { departure: { scheduledTime: { utc: "2020-01-01 09:30Z" } } }, // old, no revised
    { departure: { scheduledTime: { utc: "2020-01-02 09:30Z" }, revisedTime: { utc: "2020-01-02 10:15Z" } } },
  ];
  const best = pickBestLeg(legs);
  assert.equal(best.departure?.revisedTime?.utc, "2020-01-02 10:15Z");
});
