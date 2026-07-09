import assert from "node:assert/strict";
import { test } from "node:test";

import { detectStatusChange } from "../src/lib/status-change.ts";

test("stable status with no delay → no alert", () => {
  assert.equal(
    detectStatusChange({ status: "scheduled", depDelay: null }, { status: "scheduled", depDelay: 0 }),
    null,
  );
});

test("unknown current status never alerts (data gap)", () => {
  assert.equal(
    detectStatusChange({ status: "active", depDelay: 0 }, { status: "unknown", depDelay: null }),
    null,
  );
});

test("newly cancelled → critical", () => {
  const r = detectStatusChange({ status: "scheduled", depDelay: 0 }, { status: "cancelled", depDelay: null });
  assert.equal(r?.severity, "critical");
  assert.match(r!.reason, /cancelled/);
});

test("newly diverted → critical", () => {
  const r = detectStatusChange({ status: "active", depDelay: 0 }, { status: "diverted", depDelay: null });
  assert.equal(r?.severity, "critical");
});

test("already cancelled → no re-alert (throttle by persisted state)", () => {
  assert.equal(
    detectStatusChange({ status: "cancelled", depDelay: null }, { status: "cancelled", depDelay: null }),
    null,
  );
});

test("delay crossing the 120-minute care threshold → warning", () => {
  const r = detectStatusChange({ status: "scheduled", depDelay: 30 }, { status: "scheduled", depDelay: 130 });
  assert.equal(r?.severity, "warning");
  assert.match(r!.reason, /care/);
});

test("delay crossing the 180-minute compensation threshold → compensation warning", () => {
  const r = detectStatusChange({ status: "scheduled", depDelay: 130 }, { status: "scheduled", depDelay: 200 });
  assert.equal(r?.severity, "warning");
  assert.match(r!.reason, /compensation/);
});

test("delay already past threshold, only growing → no repeat alert", () => {
  assert.equal(
    detectStatusChange({ status: "scheduled", depDelay: 130 }, { status: "scheduled", depDelay: 150 }),
    null,
  );
});

test("first observation already cancelled → critical", () => {
  const r = detectStatusChange(null, { status: "cancelled", depDelay: null });
  assert.equal(r?.severity, "critical");
});

test("first observation on-time → no alert", () => {
  assert.equal(detectStatusChange(null, { status: "scheduled", depDelay: 0 }), null);
});

test("first observation already long-delayed → compensation warning", () => {
  const r = detectStatusChange(null, { status: "scheduled", depDelay: 240 });
  assert.equal(r?.severity, "warning");
  assert.match(r!.reason, /compensation/);
});
