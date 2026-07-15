import assert from "node:assert/strict";
import { test } from "node:test";

import { applyOverride, type Advisory } from "../src/lib/advisory.ts";
import { highRiskLevel } from "../src/lib/high-risk.ts";

function base(level: Advisory["level"], score: number): Advisory {
  return { code: "IL", name: "Israel", score, level, label: "x", message: "orig", source: "src", updated: "2020-01-01" };
}

test("override raises a too-low aggregator level (the Israel case)", () => {
  const raised = applyOverride("IL", base("low", 1.5));
  assert.equal(raised?.level, "high"); // IL is listed as high-risk
  assert.equal(raised?.elevated, true);
  assert.ok(raised!.score >= 4);
});

test("override synthesises an advisory when the aggregator has nothing", () => {
  const synth = applyOverride("SY", null); // Syria = extreme
  assert.equal(synth?.level, "extreme");
  assert.equal(synth?.elevated, true);
  assert.ok(synth?.message && synth.message.length > 0);
});

test("override never lowers an already-higher level", () => {
  const kept = applyOverride("IL", base("extreme", 5)); // aggregator worse than override
  assert.equal(kept?.level, "extreme");
  assert.notEqual(kept?.elevated, true); // not raised
});

test("non-listed countries pass through untouched", () => {
  assert.equal(highRiskLevel("FR"), null);
  const passthrough = applyOverride("FR", base("low", 1));
  assert.equal(passthrough?.level, "low");
  assert.notEqual(passthrough?.elevated, true);
});

test("a listed country with no data still yields a warning (fails toward caution)", () => {
  const r = applyOverride("UA", null); // Ukraine = extreme
  assert.equal(r?.level, "extreme");
});
