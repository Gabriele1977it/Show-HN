import { Router, type IRouter } from "express";

import { CITY_COSTS, DATA_VERSION, type CityCost } from "../lib/cost-of-living-data";
import { COUNTRY_ISO3, getPriceLevels, priceIndexUK100 } from "../lib/worldbank";

const router: IRouter = Router();

const CITY_BY_CODE = new Map(CITY_COSTS.map((c) => [c.code, c]));

// The monthly total assumes ~8 meals out, matching the copy shown in the app.
const MEALS_PER_MONTH = 8;

export interface BudgetNumbers {
  rent: number;
  utilities: number;
  groceries: number;
  dining: number; // one inexpensive meal
  transport: number;
  gym: number;
  monthlyTotal: number;
}

// Turn a curated city record into the budget shape the client renders. All
// figures are already in GBP, so there is no FX conversion (and no way for a
// flaky exchange feed to distort the comparison).
export function computeBudget(c: CityCost): BudgetNumbers {
  const rent = Math.round(c.rent);
  const utilities = Math.round(c.utilities);
  const groceries = Math.round(c.groceries);
  const dining = c.meal;
  const transport = Math.round(c.transport);
  const gym = Math.round(c.gym);
  const monthlyTotal = Math.round(rent + utilities + groceries + dining * MEALS_PER_MONTH + transport + gym);
  return { rent, utilities, groceries, dining, transport, gym, monthlyTotal };
}

export interface CityBudget {
  code: string;
  label: string;
  country: string;
  currency: string;
  budget: BudgetNumbers;
  // World Bank overall price level for the city's country, UK = 100. Null if the
  // country isn't covered. This is a real, sourced cross-check on how expensive
  // the place is overall (a wider basket than our traveller estimate).
  priceIndex: number | null;
}

export interface CostOfLivingResponse {
  a: CityBudget;
  b: CityBudget;
  dataVersion: string;
  priceIndex: {
    source: string;
    year: number;
    live: boolean; // true when served from the live World Bank feed
  };
  cachedUntil: string;
}

function toCityBudget(c: CityCost, ratios: Record<string, number>): CityBudget {
  const iso = COUNTRY_ISO3[c.country];
  return {
    code: c.code,
    label: c.label,
    country: c.country,
    currency: c.currency,
    budget: computeBudget(c),
    priceIndex: iso ? priceIndexUK100(iso, ratios) : null,
  };
}

// List of comparable cities for the picker.
router.get("/cost-of-living/cities", (_req, res) => {
  res.json(
    CITY_COSTS.map((c) => ({ code: c.code, label: c.label, country: c.country })).sort((x, y) =>
      x.label.localeCompare(y.label),
    ),
  );
});

// Compare two cities: /cost-of-living?a=LON&b=HRG
router.get("/cost-of-living", async (req, res) => {
  const aCode = typeof req.query.a === "string" ? req.query.a.toUpperCase() : "LON";
  const bCode = typeof req.query.b === "string" ? req.query.b.toUpperCase() : "HRG";
  const aCity = CITY_BY_CODE.get(aCode);
  const bCity = CITY_BY_CODE.get(bCode);

  if (!aCity || !bCity) {
    res.status(400).json({ error: "Unknown city code", validCodes: CITY_COSTS.map((c) => c.code) });
    return;
  }

  // Real World Bank price levels (cached ~30 days, bundled snapshot fallback).
  const wb = await getPriceLevels();

  const result: CostOfLivingResponse = {
    a: toCityBudget(aCity, wb.ratios),
    b: toCityBudget(bCity, wb.ratios),
    dataVersion: DATA_VERSION,
    priceIndex: { source: "World Bank", year: wb.year, live: wb.live },
    // The breakdown is static; a nominal 24h horizon keeps the client cache sane.
    cachedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  res.json(result);
});

export default router;
