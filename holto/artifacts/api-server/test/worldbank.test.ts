import assert from "node:assert/strict";
import { test } from "node:test";

import { COUNTRY_ISO3, WB_SNAPSHOT, priceIndexUK100 } from "../src/lib/worldbank.ts";
import { CITY_COSTS } from "../src/lib/cost-of-living-data.ts";
import { computeBudget } from "../src/routes/cost-of-living.ts";

test("every dataset country maps to an ISO3 with a snapshot value", () => {
  const countries = new Set(CITY_COSTS.map((c) => c.country));
  for (const country of countries) {
    const iso = COUNTRY_ISO3[country];
    assert.ok(iso, `no ISO3 mapping for "${country}"`);
    assert.ok(WB_SNAPSHOT[iso] > 0, `no snapshot price level for ${iso} (${country})`);
  }
});

test("priceIndexUK100 sets the UK to 100 and scales others correctly", () => {
  assert.equal(priceIndexUK100("GBR", WB_SNAPSHOT), 100);
  // Egypt should be far below the UK; India well below.
  assert.ok(priceIndexUK100("EGY", WB_SNAPSHOT)! < 40);
  assert.ok(priceIndexUK100("IND", WB_SNAPSHOT)! < 40);
  // The US should be near the UK.
  assert.ok(priceIndexUK100("USA", WB_SNAPSHOT)! > 90);
});

test("priceIndexUK100 returns null for unknown countries", () => {
  assert.equal(priceIndexUK100("ZZZ", WB_SNAPSHOT), null);
});

// The whole point of the anchor: our estimated GBP totals must not contradict
// the authoritative World Bank ordering. Cheaper-per-WB countries should have
// cheaper HOLTO estimates, checked pairwise across representative cities.
test("HOLTO estimates agree with the World Bank ordering", () => {
  const pick = (code: string) => CITY_COSTS.find((c) => c.code === code)!;
  const pairs: [string, string][] = [
    ["LON", "HRG"], // UK ≫ Egypt
    ["LON", "DEL"], // UK ≫ India
    ["LON", "LIS"], // UK ≫ Portugal
    ["LIS", "HRG"], // Portugal ≫ Egypt
    ["SIN", "BKK"], // Singapore ≫ Thailand
  ];
  for (const [hi, lo] of pairs) {
    const hiCity = pick(hi);
    const loCity = pick(lo);
    const wbHi = priceIndexUK100(COUNTRY_ISO3[hiCity.country], WB_SNAPSHOT)!;
    const wbLo = priceIndexUK100(COUNTRY_ISO3[loCity.country], WB_SNAPSHOT)!;
    assert.ok(wbHi > wbLo, `WB expects ${hi} > ${lo}`);
    const estHi = computeBudget(hiCity).monthlyTotal;
    const estLo = computeBudget(loCity).monthlyTotal;
    assert.ok(estHi > estLo, `HOLTO estimate should agree: ${hi} (${estHi}) > ${lo} (${estLo})`);
  }
});
