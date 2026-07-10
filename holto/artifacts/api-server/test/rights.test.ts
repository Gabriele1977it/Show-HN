import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDeterministicAnalysis, isDisruptionKind } from "../src/lib/rights.ts";

const baseInput = {
  airline: "British Airways",
  flightNumber: "BA245",
  origin: "LHR",
  destination: "CDG",
  scheduledAt: "2026-07-10 10:30",
  details: "No additional details provided.",
};

test("isDisruptionKind guards the union", () => {
  assert.equal(isDisruptionKind("delay"), true);
  assert.equal(isDisruptionKind("cancellation"), true);
  assert.equal(isDisruptionKind("banana"), false);
});

test("every disruption's rights end with the guidance disclaimer", () => {
  for (const disruptionType of ["delay", "cancellation", "denied_boarding", "missed_connection"]) {
    const a = buildDeterministicAnalysis({ ...baseInput, disruptionType });
    assert.match(a.rights, /not legal advice\.$/);
  }
});

test("a known short-haul delay cites the computed amount (deterministic, not invented)", () => {
  const a = buildDeterministicAnalysis({ ...baseInput, disruptionType: "delay" });
  assert.ok(a.eu261 && a.eu261.amount === 250);
  assert.match(a.rights, /€250/);
});

test("actions and checklist are well-formed", () => {
  const a = buildDeterministicAnalysis({ ...baseInput, disruptionType: "cancellation" });
  assert.ok(a.actions.length >= 4);
  assert.ok(a.checklist.length >= 5 && a.checklist.length <= 8);
  for (const item of a.checklist) {
    assert.ok(item.id && item.text);
    assert.ok(["documentation", "contact", "claim", "practical"].includes(item.category ?? ""));
  }
  assert.equal(a.proactiveAction.urgency, "high");
  assert.ok(a.companionMessage.length > 0);
});

test("unknown disruption type falls back to the delay template (never crashes)", () => {
  const a = buildDeterministicAnalysis({ ...baseInput, disruptionType: "meteor-strike" });
  assert.match(a.rights, /not legal advice\.$/);
  assert.ok(a.actions.length >= 4);
});

test("an unknown route still yields full guidance without a specific amount", () => {
  const a = buildDeterministicAnalysis({ ...baseInput, origin: "XXX", destination: "YYY", disruptionType: "delay" });
  assert.equal(a.eu261, null);
  assert.match(a.rights, /depends on your flight distance/);
  assert.match(a.rights, /not legal advice\.$/);
});
