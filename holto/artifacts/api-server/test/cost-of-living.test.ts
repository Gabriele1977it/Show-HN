import assert from "node:assert/strict";
import { test } from "node:test";

import { computeBudget } from "../src/routes/cost-of-living.ts";
import { CITY_COSTS } from "../src/lib/cost-of-living-data.ts";

const london = CITY_COSTS.find((c) => c.code === "LON")!;
const hurghada = CITY_COSTS.find((c) => c.code === "HRG")!;
const delhi = CITY_COSTS.find((c) => c.code === "DEL")!;

test("computeBudget passes GBP figures straight through (no FX distortion)", () => {
  const b = computeBudget(london);
  assert.equal(b.rent, london.rent);
  assert.equal(b.utilities, london.utilities);
  assert.equal(b.groceries, london.groceries);
  assert.equal(b.dining, london.meal);
  assert.equal(b.transport, london.transport);
  assert.equal(b.gym, london.gym);
});

test("monthlyTotal assumes 8 meals out, matching the app copy", () => {
  const b = computeBudget(london);
  assert.equal(b.monthlyTotal, b.rent + b.utilities + b.groceries + b.dining * 8 + b.transport + b.gym);
});

test("relative levels are realistic: Hurghada and Delhi are far cheaper than London", () => {
  const lon = computeBudget(london).monthlyTotal;
  const hrg = computeBudget(hurghada).monthlyTotal;
  const del = computeBudget(delhi).monthlyTotal;
  // Both should be at least 60% cheaper than London — the cases the user flagged.
  assert.ok(hrg < lon * 0.4, `Hurghada (${hrg}) should be well under 40% of London (${lon})`);
  assert.ok(del < lon * 0.4, `Delhi (${del}) should be well under 40% of London (${lon})`);
});

test("Delhi is present (the case that previously broke the comparison)", () => {
  assert.ok(delhi, "Delhi must be in the dataset");
});

test("every city has a unique code and positive, sane figures", () => {
  const codes = new Set(CITY_COSTS.map((c) => c.code));
  assert.equal(codes.size, CITY_COSTS.length, "codes must be unique");
  for (const c of CITY_COSTS) {
    for (const field of ["rent", "utilities", "groceries", "meal", "transport", "gym"] as const) {
      assert.ok(c[field] > 0, `${c.code} ${field} must be positive`);
    }
    assert.ok(c.label.length > 0 && c.country.length > 0, `${c.code} needs label + country`);
    // A one-bed rent that is below a single meal is almost certainly a data slip.
    assert.ok(c.rent > c.meal, `${c.code} rent should exceed a single meal`);
  }
});
