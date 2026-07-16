import assert from "node:assert/strict";
import { test } from "node:test";

import {
  candidateFlightNumbers,
  deriveStatus,
  effectiveDelayMinutes,
  friendlyStatusMessage,
  mapStatus,
  minutesBetween,
  officialStatusUrl,
} from "../src/lib/flight-format.ts";

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
  const m = friendlyStatusMessage("delayed", 45, "B12", "2");
  assert.match(m, /45 min/);
  assert.match(m, /gate B12/);
  assert.match(m, /Terminal 2/);
});

test("friendlyStatusMessage stays calm but honest when no delay is reported", () => {
  const m = friendlyStatusMessage("scheduled", 5, null, null);
  assert.match(m, /no delay reported/i);
});

test("friendlyStatusMessage handles unknown gracefully", () => {
  assert.match(friendlyStatusMessage("unknown", null, null, null), /couldn't confirm/i);
});

// ── Time-aware delay derivation (the EY64 "on time when actually delayed" bug) ──

test("mapStatus recognises 'delayed' and normalises en-route/redirected", () => {
  assert.equal(mapStatus("delayed"), "delayed");
  assert.equal(mapStatus("en-route"), "active");
  assert.equal(mapStatus("redirected"), "diverted");
  assert.equal(mapStatus("something-odd"), "unknown");
});

test("minutesBetween computes the gap and tolerates bad input", () => {
  assert.equal(minutesBetween("2026-07-15T14:45:00Z", "2026-07-15T17:10:00Z"), 145);
  assert.equal(minutesBetween(null, "2026-07-15T17:10:00Z"), null);
  assert.equal(minutesBetween("nonsense", "2026-07-15T17:10:00Z"), null);
});

test("effectiveDelayMinutes takes the worst of provider delay and estimated/actual gap", () => {
  // Provider says 0 but the estimated time is 145 min later → 145.
  assert.equal(
    effectiveDelayMinutes(null, "2026-07-15T14:45:00Z", "2026-07-15T17:10:00Z", null),
    145,
  );
  // Provider delay wins when larger.
  assert.equal(effectiveDelayMinutes(200, "2026-07-15T14:45:00Z", "2026-07-15T15:00:00Z", null), 200);
  assert.equal(effectiveDelayMinutes(null, null, null, null), null);
});

test("deriveStatus surfaces 'delayed' even when the provider still says 'scheduled'", () => {
  assert.equal(deriveStatus("scheduled", 145), "delayed"); // the EY64 case
  assert.equal(deriveStatus("scheduled", 5), "scheduled"); // below threshold
  assert.equal(deriveStatus("scheduled", null), "scheduled");
});

test("deriveStatus never downgrades a terminal / in-air provider status", () => {
  assert.equal(deriveStatus("cancelled", 200), "cancelled");
  assert.equal(deriveStatus("landed", 200), "landed");
  assert.equal(deriveStatus("active", 200), "active");
});

test("the scheduled message no longer over-claims 'on time'", () => {
  const msg = friendlyStatusMessage("scheduled", null, null, "4");
  assert.doesNotMatch(msg, /on schedule/i);
  assert.match(msg, /airline/i); // points to the source of truth
});

test("officialStatusUrl builds a searchable live-status link", () => {
  assert.match(officialStatusUrl("EY64"), /google\.com\/search/);
  assert.match(officialStatusUrl("EY64"), /EY64.*flight.*status/);
});
