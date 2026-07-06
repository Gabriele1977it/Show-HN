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

test("tester tier: hidden from pricing, full features, tight daily quotas", () => {
  // Not purchasable — the public pricing endpoints must not show it…
  assert.ok(!listPlans().some((p) => p.id === "tester"));
  // …but it's a real plan with every feature on and beta-sized limits.
  const t = getPlan("tester");
  assert.equal(t.hidden, true);
  assert.deepEqual(t.features, { sharing: true, reminders: true, stats: true, enrich: true });
  assert.equal(t.maxDecks, 20);
  assert.equal(t.maxCards, 1000);
  assert.equal(t.aiPerDay, 25);
  assert.equal(t.importsPerDay, 10);
  assert.equal(canAdd("tester", "decks", 20), false);
});

test("plans carry per-day AI/import quotas (the operator's cost backstops)", () => {
  assert.equal(getPlan("free").aiPerDay, 0);
  assert.equal(getPlan("pro").aiPerDay, 300);
  assert.equal(getPlan("pro").importsPerDay, 50);
  assert.equal(getPlan("team").aiPerDay, 600);
  assert.equal(planPublic("pro").aiPerDay, 300); // exposed for the UI
});

test("planPublic exposes annual pricing + saving; free has none", () => {
  const pro = planPublic("pro");
  assert.equal(pro.priceYear, 79);
  // $79/yr vs $7.99×12 = $95.88 → ~18% saving.
  assert.equal(pro.yearSavingPct, 18);
  const team = planPublic("team");
  assert.equal(team.priceYear, 199);
  assert.ok(team.yearSavingPct > 0);
  const free = planPublic("free");
  assert.equal(free.priceYear, null);
  assert.equal(free.yearSavingPct, 0);
});
