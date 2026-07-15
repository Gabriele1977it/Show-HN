import assert from "node:assert/strict";
import { test } from "node:test";

import { escalate, type Advisory, type Override } from "../src/lib/advisory.ts";
import { highRiskLevel } from "../src/lib/high-risk.ts";
import { parseStateDeptFeed } from "../src/lib/statedept.ts";

function base(level: Advisory["level"], score: number): Advisory {
  return { code: "IL", name: "Israel", score, level, label: "x", message: "orig", source: "src", updated: "2020-01-01" };
}
const HIGH: Override = { level: "high", updated: "2026-07-01", source: "US State Department" };
const EXTREME: Override = { level: "extreme", updated: "2026-07-01", source: "US State Department" };

test("escalate raises a too-low aggregator level (the Israel case)", () => {
  const raised = escalate("IL", base("low", 1.5), HIGH);
  assert.equal(raised?.level, "high");
  assert.equal(raised?.elevated, true);
  assert.ok(raised!.score >= 4);
});

test("escalate synthesises an advisory when the aggregator has nothing", () => {
  const synth = escalate("SY", null, EXTREME);
  assert.equal(synth?.level, "extreme");
  assert.equal(synth?.elevated, true);
  assert.ok(synth?.message && synth.message.length > 0);
});

test("escalate never lowers an already-higher level", () => {
  const kept = escalate("IL", base("extreme", 5), HIGH);
  assert.equal(kept?.level, "extreme");
  assert.notEqual(kept?.elevated, true);
});

test("no override passes the advisory through untouched", () => {
  assert.equal(highRiskLevel("FR"), null);
  const passthrough = escalate("FR", base("low", 1), null);
  assert.equal(passthrough?.level, "low");
  assert.notEqual(passthrough?.elevated, true);
});

test("curated backstop still lists the major conflict zones", () => {
  assert.equal(highRiskLevel("UA"), "extreme");
  assert.equal(highRiskLevel("IL"), "high");
});

// The automation: parse a realistic State Dept RSS sample.
const SAMPLE = `<?xml version="1.0"?><rss><channel>
  <item><title>France Travel Advisory</title><category>Level 2: Exercise Increased Caution</category><pubDate>Mon, 01 Jun 2026 00:00:00 EST</pubDate></item>
  <item><title>Israel, the West Bank and Gaza Travel Advisory</title><category>Level 3: Reconsider Travel</category><pubDate>Tue, 07 Jul 2026 00:00:00 EST</pubDate></item>
  <item><title>Ukraine Travel Advisory</title><description>Level 4: Do Not Travel</description><pubDate>Wed, 08 Jul 2026 00:00:00 EST</pubDate></item>
  <item><title>Burma (Myanmar) Travel Advisory</title><category>Level 4: Do Not Travel</category></item>
</channel></rss>`;

test("parseStateDeptFeed extracts Level 3/4 countries and maps names to codes", () => {
  const m = parseStateDeptFeed(SAMPLE);
  assert.equal(m.has("FR"), false); // Level 2 does not escalate
  assert.equal(m.get("IL")?.level, "high"); // Level 3, comma-name resolved to Israel
  assert.equal(m.get("UA")?.level, "extreme"); // Level 4 from <description>
  assert.equal(m.get("MM")?.level, "extreme"); // "Burma (Myanmar)" alias → MM
  assert.equal(m.get("IL")?.updated, "2026-07-07");
});
