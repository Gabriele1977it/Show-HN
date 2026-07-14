import assert from "node:assert/strict";
import { test } from "node:test";

import { zoneFor, utcMinToLocalHHMM, utcOffsetLabel } from "../src/lib/timezone.ts";

test("zoneFor resolves real IANA zones from coordinates", () => {
  assert.equal(zoneFor(51.5074, -0.1278), "Europe/London");
  assert.equal(zoneFor(28.6139, 77.209), "Asia/Kolkata"); // India: half-hour offset
  assert.equal(zoneFor(27.2579, 33.8116), "Africa/Cairo"); // Hurghada
  assert.equal(zoneFor(40.7128, -74.006), "America/New_York");
});

test("utcMinToLocalHHMM applies British Summer Time in July (UTC+1)", () => {
  // 03:50 UTC on 14 Jul 2026 -> 04:50 BST.
  assert.equal(utcMinToLocalHHMM(2026, 7, 14, 3 * 60 + 50, "Europe/London"), "04:50");
});

test("utcMinToLocalHHMM uses GMT in January (UTC+0, no DST)", () => {
  // 08:00 UTC on 14 Jan 2026 -> 08:00 GMT.
  assert.equal(utcMinToLocalHHMM(2026, 1, 14, 8 * 60, "Europe/London"), "08:00");
});

test("utcMinToLocalHHMM handles India's half-hour offset (UTC+5:30)", () => {
  // 01:00 UTC -> 06:30 IST.
  assert.equal(utcMinToLocalHHMM(2026, 7, 14, 60, "Asia/Kolkata"), "06:30");
});

test("utcOffsetLabel reflects DST and half-hour zones", () => {
  assert.equal(utcOffsetLabel(2026, 7, 14, "Europe/London"), "UTC+1"); // summer
  assert.equal(utcOffsetLabel(2026, 1, 14, "Europe/London"), "UTC"); // winter GMT
  assert.equal(utcOffsetLabel(2026, 7, 14, "Asia/Kolkata"), "UTC+5:30");
});
