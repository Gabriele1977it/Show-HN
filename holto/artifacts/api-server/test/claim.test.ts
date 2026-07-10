import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildClaimLetter,
  canTransition,
  computeClaimAmount,
  escalationGuidance,
  isClaimStatus,
} from "../src/lib/claim.ts";

test("isClaimStatus guards the lifecycle set", () => {
  assert.equal(isClaimStatus("submitted"), true);
  assert.equal(isClaimStatus("paid"), true);
  assert.equal(isClaimStatus("banana"), false);
});

test("status transitions follow the lifecycle", () => {
  assert.equal(canTransition("draft", "submitted"), true);
  assert.equal(canTransition("draft", "paid"), false); // must be submitted first
  assert.equal(canTransition("submitted", "paid"), true);
  assert.equal(canTransition("rejected", "escalated"), true);
  assert.equal(canTransition("paid", "closed"), true);
  assert.equal(canTransition("closed", "submitted"), false); // terminal
  assert.equal(canTransition("submitted", "submitted"), true); // no-op allowed
});

test("computeClaimAmount reflects distance tiers", () => {
  const short = computeClaimAmount("LHR", "CDG", "delay");
  assert.equal(short?.amount, 250);
  const long = computeClaimAmount("LHR", "JFK", "delay");
  assert.equal(long?.amount, 600);
});

test("computeClaimAmount returns null for unknown routes and non-fixed types", () => {
  assert.equal(computeClaimAmount("XXX", "YYY", "delay"), null);
  assert.equal(computeClaimAmount("LHR", "CDG", "missed_connection"), null);
});

test("the letter is deterministic, cites the regulation and the computed amount", () => {
  const letter = buildClaimLetter({
    airline: "British Airways",
    flightNumber: "BA245",
    origin: "LHR",
    destination: "CDG",
    scheduledAt: "2026-07-10 10:30",
    disruptionType: "delay",
    amount: 250,
    currency: "EUR",
    claimantName: "Alex Traveller",
    claimantEmail: "alex@example.com",
  });
  assert.match(letter, /Regulation \(EC\) No 261\/2004/);
  assert.match(letter, /BA245/);
  assert.match(letter, /€250/);
  assert.match(letter, /Alex Traveller/);
  assert.match(letter, /alex@example\.com/);
});

test("the letter leaves clear placeholders for details we don't hold", () => {
  const letter = buildClaimLetter({
    airline: "Ryanair",
    flightNumber: "FR123",
    origin: "STN",
    destination: "BCN",
    scheduledAt: "2026-08-01 06:00",
    disruptionType: "cancellation",
    amount: null,
    currency: "EUR",
  });
  assert.match(letter, /\[Your full name\]/);
  assert.match(letter, /\[Your booking reference\]/);
});

test("escalation guidance names real regulators, not fabricated contacts", () => {
  const g = escalationGuidance();
  assert.match(g, /Civil Aviation Authority/);
  assert.match(g, /National Enforcement Body/);
  assert.match(g, /not legal advice/);
});
