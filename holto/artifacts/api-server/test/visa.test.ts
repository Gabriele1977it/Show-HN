import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeRequirement, parseTidyCsv, officialSources } from "../src/lib/visa.ts";

test("numeric requirement means visa-free with a day limit", () => {
  const r = normalizeRequirement("90");
  assert.equal(r?.category, "visa_free");
  assert.equal(r?.allowedDays, 90);
  assert.equal(r?.tone, "good");
});

test("phrase requirements map to the right category and tone", () => {
  assert.equal(normalizeRequirement("visa on arrival")?.category, "visa_on_arrival");
  assert.equal(normalizeRequirement("e-visa")?.category, "e_visa");
  assert.equal(normalizeRequirement("eta")?.category, "eta");
  assert.equal(normalizeRequirement("visa required")?.category, "visa_required");
  assert.equal(normalizeRequirement("visa required")?.tone, "bad");
  assert.equal(normalizeRequirement("no admission")?.category, "no_admission");
});

test("blank and self markers return null (no false guidance)", () => {
  assert.equal(normalizeRequirement(""), null);
  assert.equal(normalizeRequirement("-1"), null);
});

test("parseTidyCsv builds a passport→destination map and skips the header", () => {
  const csv = "Passport,Destination,Requirement\nGB,FR,90\nGB,TH,visa on arrival\nGB,IN,e-visa\n";
  const m = parseTidyCsv(csv);
  assert.equal(m.get("GB")?.get("FR"), "90");
  assert.equal(m.get("GB")?.get("TH"), "visa on arrival");
  assert.equal(m.get("GB")?.get("IN"), "e-visa");
  assert.equal(m.has("Passport"), false); // header not treated as data
});

test("officialSources always includes an authoritative link with a correct gov.uk slug", () => {
  const links = officialSources("GB", "AE", "United Arab Emirates");
  assert.ok(links.length >= 1);
  assert.match(links[0].url, /gov\.uk\/foreign-travel-advice\/united-arab-emirates\/entry-requirements/);
});

test("officialSources adds the traveller's own government when known", () => {
  const links = officialSources("US", "TH", "Thailand");
  assert.ok(links.some((l) => l.url.includes("travel.state.gov")));
});
