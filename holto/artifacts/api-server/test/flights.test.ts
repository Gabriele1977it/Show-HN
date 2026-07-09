import assert from "node:assert/strict";
import { test } from "node:test";

import { candidateFlightNumbers, mapStatus } from "../src/lib/flight-format.ts";

test("candidateFlightNumbers converts known ICAO prefix to IATA", () => {
  // easyJet: EZY → U2
  assert.deepEqual(candidateFlightNumbers("EZY8743"), ["EZY8743", "U28743"]);
});

test("candidateFlightNumbers leaves an IATA flight number unchanged", () => {
  assert.deepEqual(candidateFlightNumbers("BA245"), ["BA245"]);
});

test("candidateFlightNumbers returns input unchanged when it doesn't match the pattern", () => {
  assert.deepEqual(candidateFlightNumbers("not-a-flight"), ["not-a-flight"]);
});

test("mapStatus passes through known statuses", () => {
  assert.equal(mapStatus("cancelled"), "cancelled");
  assert.equal(mapStatus("active"), "active");
});

test("mapStatus maps unknown/undefined to 'unknown'", () => {
  assert.equal(mapStatus("banana"), "unknown");
  assert.equal(mapStatus(undefined), "unknown");
});
