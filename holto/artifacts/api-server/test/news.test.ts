import assert from "node:assert/strict";
import { test } from "node:test";

import { __test } from "../src/lib/news";
import { normaliseAccount } from "../src/lib/awardwallet";

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example</title>
  <item>
    <title><![CDATA[Air strike disrupts flights across Europe]]></title>
    <link>https://example.com/a</link>
    <pubDate>Wed, 08 Jan 2026 09:30:00 GMT</pubDate>
  </item>
  <item>
    <title>Second &amp; story</title>
    <link>https://example.com/b</link>
    <pubDate>Tue, 07 Jan 2026 12:00:00 GMT</pubDate>
  </item>
  <item>
    <title>No link should be skipped</title>
    <pubDate>Mon, 06 Jan 2026 12:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

test("parseFeed extracts items, handles CDATA and entities, skips linkless", () => {
  const feed = { url: "u", source: "Example", category: "world" as const };
  const items = __test.parseFeed(SAMPLE_RSS, feed);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Air strike disrupts flights across Europe");
  assert.equal(items[0].link, "https://example.com/a");
  assert.equal(items[0].source, "Example");
  assert.equal(items[0].category, "world");
  assert.ok(items[0].publishedAt?.startsWith("2026-01-08"));
  assert.equal(items[1].title, "Second & story");
});

test("decodeEntities strips tags and decodes numeric entities", () => {
  assert.equal(__test.decodeEntities("Ben &amp; Jerry&#39;s <b>x</b>"), "Ben & Jerry's x");
});

test("normaliseAccount maps category, balance and membership", () => {
  const n = normaliseAccount({
    displayName: "British Airways Executive Club",
    kind: "airline",
    balanceRaw: 45120,
    properties: [
      { name: "Membership Number", value: "BA12345678" },
      { name: "Status Level", value: "Silver" },
    ],
    expirationDate: "2027-03-01T00:00:00Z",
  });
  assert.ok(n);
  assert.equal(n!.category, "airline");
  assert.equal(n!.programName, "British Airways Executive Club");
  assert.equal(n!.membershipNumber, "BA12345678");
  assert.equal(n!.tier, "Silver");
  assert.equal(n!.pointsBalance, 45120);
  assert.equal(n!.expiresAt, "2027-03-01");
});

test("normaliseAccount parses a formatted balance string when raw is absent", () => {
  const n = normaliseAccount({ displayName: "Hilton Honors", kind: "hotel", balance: "128,540" });
  assert.equal(n!.category, "hotel");
  assert.equal(n!.pointsBalance, 128540);
});

test("normaliseAccount returns null without a program name", () => {
  assert.equal(normaliseAccount({ balanceRaw: 10 }), null);
});
