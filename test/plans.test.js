import { test } from "node:test";
import assert from "node:assert/strict";
import { getPlan, hasFeature, canAdd, planPublic, listPlans, DEFAULT_PLAN } from "../server/plans.js";

test("getPlan falls back to the default for unknown ids", () => {
  assert.equal(getPlan("free").id, "free");
  assert.equal(getPlan("nonsense").id, DEFAULT_PLAN);
});

test("feature flags differ by plan", () => {
  assert.equal(hasFeature("free", "sharing"), false);
  assert.equal(hasFeature("free", "stats"), false);
  assert.equal(hasFeature("pro", "sharing"), true);
  assert.equal(hasFeature("team", "reminders"), true);
});

test("canAdd enforces limits at the boundary", () => {
  // Free: 3 decks.
  assert.equal(canAdd("free", "decks", 2), true);
  assert.equal(canAdd("free", "decks", 3), false);
  // Free: 100 cards, projected count respected.
  assert.equal(canAdd("free", "cards", 98, 2), true);
  assert.equal(canAdd("free", "cards", 99, 2), false);
  // Free is solo; Team allows up to 10 members.
  assert.equal(canAdd("free", "members", 1), false);
  assert.equal(canAdd("team", "members", 9), true);
  assert.equal(canAdd("team", "members", 10), false);
  // Pro is unlimited decks/cards.
  assert.equal(canAdd("pro", "decks", 9999), true);
  assert.equal(canAdd("pro", "cards", 999999), true);
});

test("planPublic maps Infinity to null and keeps features", () => {
  const pro = planPublic("pro");
  assert.equal(pro.maxDecks, null);
  assert.equal(pro.maxCards, null);
  assert.equal(pro.maxMembers, 1);
  assert.equal(pro.features.sharing, true);
  const free = planPublic("free");
  assert.equal(free.maxDecks, 3);
});

test("listPlans returns all three tiers", () => {
  const ids = listPlans().map((p) => p.id);
  assert.deepEqual(ids, ["free", "pro", "team"]);
});
