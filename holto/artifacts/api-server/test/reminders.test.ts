import assert from "node:assert/strict";
import { test } from "node:test";

import { buildResidencyReminders, buildFlightReminder, buildLoyaltyReminder } from "../src/lib/reminder-messages.ts";
import type { CountryResidency } from "../src/lib/residency.ts";

function country(partial: Partial<CountryResidency>): CountryResidency {
  return {
    countryCode: "PT",
    countryName: "Portugal",
    daysThisYear: 0,
    daysRolling12m: 0,
    totalDays: 0,
    threshold: 183,
    status: "safe",
    daysUntilThreshold: 183,
    ...partial,
  };
}

test("safe countries produce no reminder", () => {
  assert.equal(buildResidencyReminders([country({ status: "safe" })], 2026).length, 0);
});

test("approaching country produces one dated reminder", () => {
  const msgs = buildResidencyReminders(
    [country({ status: "approaching", daysThisYear: 168, daysUntilThreshold: 15 })],
    2026,
  );
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0]!.refKey, "residency:PT:approaching:2026");
  assert.match(msgs[0]!.body, /168 days in Portugal/);
  assert.match(msgs[0]!.body, /15 left/);
});

test("over country uses a distinct refKey and message", () => {
  const msgs = buildResidencyReminders([country({ status: "over", daysThisYear: 190 })], 2026);
  assert.equal(msgs[0]!.refKey, "residency:PT:over:2026");
  assert.match(msgs[0]!.title, /183-day line passed/);
});

test("refKey is year-scoped so it can re-alert next year", () => {
  const a = buildResidencyReminders([country({ status: "approaching" })], 2026)[0]!;
  const b = buildResidencyReminders([country({ status: "approaching" })], 2027)[0]!;
  assert.notEqual(a.refKey, b.refKey);
});

test("flight reminder keys by item id and includes the time", () => {
  const msg = buildFlightReminder({ id: 42, title: "BA503 LHR→LIS", startAt: "2026-08-15T14:30:00Z" });
  assert.equal(msg.refKey, "flight:42");
  assert.equal(msg.data.tripItemId, 42);
  assert.match(msg.body, /BA503 LHR→LIS/);
  assert.match(msg.body, /14:30/);
});

test("flight reminder tolerates a missing time", () => {
  const msg = buildFlightReminder({ id: 7, title: "Some flight", startAt: null });
  assert.equal(msg.refKey, "flight:7");
  assert.doesNotMatch(msg.body, /departs at/);
});

test("loyalty reminder fires inside the window and names the tier", () => {
  const msg = buildLoyaltyReminder(
    { id: 3, programName: "BA Executive Club", tier: "Gold", expiresAt: "2026-08-01" },
    "2026-07-11",
  );
  assert.ok(msg);
  assert.equal(msg!.refKey, "loyalty:3:2026-08-01");
  assert.match(msg!.body, /Gold status and points/);
  assert.match(msg!.body, /in 21 days/);
});

test("loyalty reminder is silent well before the window", () => {
  assert.equal(
    buildLoyaltyReminder({ id: 3, programName: "X", tier: null, expiresAt: "2026-12-01" }, "2026-07-11"),
    null,
  );
});

test("loyalty reminder is silent once expired", () => {
  assert.equal(
    buildLoyaltyReminder({ id: 3, programName: "X", tier: null, expiresAt: "2026-07-01" }, "2026-07-11"),
    null,
  );
});

test("loyalty reminder needs an expiry date", () => {
  assert.equal(
    buildLoyaltyReminder({ id: 3, programName: "X", tier: null, expiresAt: null }, "2026-07-11"),
    null,
  );
});

test("loyalty reminder says 'today' on the expiry day", () => {
  const msg = buildLoyaltyReminder({ id: 9, programName: "Hilton Honors", tier: null, expiresAt: "2026-07-11" }, "2026-07-11");
  assert.ok(msg);
  assert.match(msg!.body, /expire today/);
});
