import assert from "node:assert/strict";
import { test } from "node:test";

import { candidateFlightNumbers, friendlyStatusMessage, mapStatus } from "../src/lib/flight-format.ts";

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

test("friendlyStatusMessage flags a cancellation with rights", () => {
  const m = friendlyStatusMessage("cancelled", null, null, null);
  assert.match(m, /cancelled/i);
  assert.match(m, /rights|refund|compensation/i);
});

test("friendlyStatusMessage reports a material delay and includes gate", () => {
  const m = friendlyStatusMessage("scheduled", 45, "B12", "2");
  assert.match(m, /45 min/);
  assert.match(m, /gate B12/);
  assert.match(m, /Terminal 2/);
});

test("friendlyStatusMessage stays calm when on schedule", () => {
  const m = friendlyStatusMessage("scheduled", 5, null, null);
  assert.match(m, /On schedule/i);
});

test("friendlyStatusMessage handles unknown gracefully", () => {
  assert.match(friendlyStatusMessage("unknown", null, null, null), /couldn't confirm/i);
});
