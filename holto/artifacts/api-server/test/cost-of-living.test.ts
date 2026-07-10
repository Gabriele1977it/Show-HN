import assert from "node:assert/strict";
import { test } from "node:test";

import { CITIES, computeBudget, type CityDef } from "../src/routes/cost-of-living.ts";

const london = CITIES.find((c) => c.code === "LON")!;
const hurghada = CITIES.find((c) => c.code === "HRG")!;

// A representative Zyla-style flat payload (local currency, string values).
function londonRaw(): Record<string, string> {
  return {
    "Apartment (1 bedroom) Outside of Centre": "1,800.00 £",
    "Apartment (1 bedroom) in City Centre": "2,400.00 £",
    "Basic Utilities (Electricity, Heating, Water)": "240.00 £",
    "Broadband Internet": "35.00 £",
    "Meal, Inexpensive Restaurant": "20.00 £",
    "Fitness Club, Monthly Fee for 1 Adult": "42.00 £",
    "Monthly Pass (Regular Price)": "180.00 £",
    "Milk (regular), (1 liter)": "1.20 £",
    "Loaf of Fresh White Bread (500g)": "1.20 £",
    "Rice (white), (1kg)": "1.60 £",
    "Eggs (regular) (12)": "3.00 £",
    "Chicken Fillets (1kg)": "6.50 £",
  };
}

test("known city has a valid FX rate and metadata", () => {
  assert.equal(london.currency, "GBP");
  assert.equal(london.perGBP, 1);
  assert.ok(hurghada.perGBP > 1, "Egyptian pound should be many-per-GBP");
});

test("computeBudget reads real fields and converts a 1:1 currency unchanged", () => {
  const b = computeBudget(londonRaw(), london);
  assert.equal(b.rent, 1800);
  assert.equal(b.utilities, 275); // 240 + 35
  assert.equal(b.dining, 20);
  assert.equal(b.transport, 180);
  assert.equal(b.gym, 42);
  assert.ok(b.groceries > 0, "grocery basket should compute from staples");
  assert.equal(
    b.monthlyTotal,
    b.rent + b.utilities + b.groceries + b.dining * 8 + b.transport + b.gym,
  );
});

test("FX conversion divides local amounts to GBP", () => {
  const egp: CityDef = { ...hurghada, perGBP: 100 };
  const raw = {
    "Apartment (1 bedroom) Outside of Centre": "14,000", // /100 = 140
    "Meal, Inexpensive Restaurant": "150", // /100 = 1.5 -> rounds to 2
  };
  const b = computeBudget(raw, egp);
  assert.equal(b.rent, 140);
  assert.equal(b.dining, 2);
});

test("missing optional fields fall back to a scale of the meal price (never crash)", () => {
  const raw = { "Meal, Inexpensive Restaurant": "10" };
  const b = computeBudget(raw, london);
  assert.equal(b.dining, 10);
  assert.equal(b.rent, 0);
  assert.equal(b.transport, 70); // dining * 7
  assert.equal(b.gym, 25); // dining * 2.5
  assert.equal(b.groceries, 160); // dining * 16 (no staples present)
});

test("every curated city has unique code and sane FX", () => {
  const codes = new Set(CITIES.map((c) => c.code));
  assert.equal(codes.size, CITIES.length, "codes must be unique");
  for (const c of CITIES) {
    assert.ok(c.perGBP > 0, `${c.code} perGBP must be positive`);
    assert.ok(c.city.length > 0 && c.country.length > 0, `${c.code} needs city+country`);
  }
});
