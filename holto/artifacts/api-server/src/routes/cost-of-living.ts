import { Router, type IRouter } from "express";

import { logger } from "../lib/logger";

const router: IRouter = Router();

const ZYLA_KEY = process.env.ZYLA_API_KEY ?? "";
const ZYLA_URL =
  "https://zylalabs.com/api/226/cities+cost+of+living+and+average+prices+api/3775/cost+of+living+by+city+v2";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type RawCity = Record<string, string>;
const cache = new Map<string, { data: RawCity; ts: number }>();

// Curated set of destinations the user can compare. Each carries the exact
// city/country spelling Zyla expects plus an approximate FX rate (units of the
// local currency per 1 GBP) so any city's prices convert to a common GBP view.
// FX rates are approximate and refreshed at deploy time — budgets here are
// deliberately presented as estimates, not exact figures.
export interface CityDef {
  code: string;
  label: string;
  city: string;
  country: string;
  currency: string;
  perGBP: number;
}

export const CITIES: CityDef[] = [
  { code: "LON", label: "London", city: "london", country: "united kingdom", currency: "GBP", perGBP: 1 },
  { code: "HRG", label: "Hurghada", city: "hurghada", country: "egypt", currency: "EGP", perGBP: 77 },
  { code: "SSH", label: "Sharm el-Sheikh", city: "sharm el-sheikh", country: "egypt", currency: "EGP", perGBP: 77 },
  { code: "CAI", label: "Cairo", city: "cairo", country: "egypt", currency: "EGP", perGBP: 77 },
  { code: "LIS", label: "Lisbon", city: "lisbon", country: "portugal", currency: "EUR", perGBP: 1.17 },
  { code: "OPO", label: "Porto", city: "porto", country: "portugal", currency: "EUR", perGBP: 1.17 },
  { code: "BCN", label: "Barcelona", city: "barcelona", country: "spain", currency: "EUR", perGBP: 1.17 },
  { code: "MAD", label: "Madrid", city: "madrid", country: "spain", currency: "EUR", perGBP: 1.17 },
  { code: "VLC", label: "Valencia", city: "valencia", country: "spain", currency: "EUR", perGBP: 1.17 },
  { code: "BER", label: "Berlin", city: "berlin", country: "germany", currency: "EUR", perGBP: 1.17 },
  { code: "AMS", label: "Amsterdam", city: "amsterdam", country: "netherlands", currency: "EUR", perGBP: 1.17 },
  { code: "PAR", label: "Paris", city: "paris", country: "france", currency: "EUR", perGBP: 1.17 },
  { code: "ROM", label: "Rome", city: "rome", country: "italy", currency: "EUR", perGBP: 1.17 },
  { code: "MIL", label: "Milan", city: "milan", country: "italy", currency: "EUR", perGBP: 1.17 },
  { code: "ATH", label: "Athens", city: "athens", country: "greece", currency: "EUR", perGBP: 1.17 },
  { code: "DUB", label: "Dublin", city: "dublin", country: "ireland", currency: "EUR", perGBP: 1.17 },
  { code: "PRG", label: "Prague", city: "prague", country: "czech republic", currency: "CZK", perGBP: 29 },
  { code: "BUD", label: "Budapest", city: "budapest", country: "hungary", currency: "HUF", perGBP: 455 },
  { code: "KRK", label: "Krakow", city: "krakow", country: "poland", currency: "PLN", perGBP: 5.0 },
  { code: "IST", label: "Istanbul", city: "istanbul", country: "turkey", currency: "TRY", perGBP: 44 },
  { code: "DXB", label: "Dubai", city: "dubai", country: "united arab emirates", currency: "AED", perGBP: 4.66 },
  { code: "BKK", label: "Bangkok", city: "bangkok", country: "thailand", currency: "THB", perGBP: 44 },
  { code: "DPS", label: "Bali (Denpasar)", city: "denpasar", country: "indonesia", currency: "IDR", perGBP: 20500 },
  { code: "KUL", label: "Kuala Lumpur", city: "kuala lumpur", country: "malaysia", currency: "MYR", perGBP: 5.9 },
  { code: "SIN", label: "Singapore", city: "singapore", country: "singapore", currency: "SGD", perGBP: 1.71 },
  { code: "TYO", label: "Tokyo", city: "tokyo", country: "japan", currency: "JPY", perGBP: 195 },
  { code: "MEX", label: "Mexico City", city: "mexico city", country: "mexico", currency: "MXN", perGBP: 23 },
  { code: "TBS", label: "Tbilisi", city: "tbilisi", country: "georgia", currency: "GEL", perGBP: 3.4 },
  { code: "CPT", label: "Cape Town", city: "cape town", country: "south africa", currency: "ZAR", perGBP: 23 },
  { code: "RAK", label: "Marrakech", city: "marrakesh", country: "morocco", currency: "MAD", perGBP: 12.6 },
  { code: "NYC", label: "New York", city: "new york", country: "united states", currency: "USD", perGBP: 1.27 },
  { code: "TOR", label: "Toronto", city: "toronto", country: "canada", currency: "CAD", perGBP: 1.73 },
  { code: "SYD", label: "Sydney", city: "sydney", country: "australia", currency: "AUD", perGBP: 1.93 },
  { code: "SAI", label: "Ho Chi Minh City", city: "ho chi minh city", country: "vietnam", currency: "VND", perGBP: 32000 },
];

const CITY_BY_CODE = new Map(CITIES.map((c) => [c.code, c]));

async function fetchCity(def: CityDef): Promise<RawCity> {
  const hit = cache.get(def.code);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  const url = `${ZYLA_URL}?city=${encodeURIComponent(def.city)}&country=${encodeURIComponent(def.country)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ZYLA_KEY}` },
  });
  if (!res.ok) throw new Error(`Zyla ${def.code}: HTTP ${res.status}`);
  const data = (await res.json()) as RawCity;
  if (!data || typeof data !== "object" || !Object.keys(data).length) {
    throw new Error(`Zyla ${def.code}: empty response`);
  }
  cache.set(def.code, { data, ts: Date.now() });
  return data;
}

// ── Live foreign-exchange rates ─────────────────────────────────────────────
// Rates are fetched (base GBP) from a free, key-less endpoint and cached for a
// day. Each city's hardcoded `perGBP` is the fallback if the feed is missing a
// currency or unreachable, so conversion always works.
const FX_URL = "https://open.er-api.com/v6/latest/GBP";
let fxCache: { rates: Record<string, number>; ts: number } | null = null;

async function fetchFxRates(): Promise<Record<string, number>> {
  if (fxCache && Date.now() - fxCache.ts < CACHE_TTL_MS) return fxCache.rates;
  try {
    const res = await fetch(FX_URL);
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (json.result !== "success" || !json.rates || typeof json.rates !== "object") {
      throw new Error("FX malformed response");
    }
    fxCache = { rates: json.rates, ts: Date.now() };
    return json.rates;
  } catch (err) {
    logger.warn({ err }, "FX rate fetch failed; using fallback rates");
    return {};
  }
}

// Units of the city's local currency per 1 GBP: live rate when available and
// sane, otherwise the curated fallback baked into the city definition.
export function resolvePerGBP(def: CityDef, rates: Record<string, number>): number {
  const live = rates[def.currency];
  return typeof live === "number" && live > 0 ? live : def.perGBP;
}

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[^\d,.]/g, "").replace(/,/g, "")) || 0;
}

function findKey(raw: RawCity, ...fragments: string[]): number {
  for (const key of Object.keys(raw)) {
    const lower = key.toLowerCase();
    if (fragments.every((f) => lower.includes(f.toLowerCase()))) {
      return parseNum(raw[key]);
    }
  }
  return 0;
}

export interface BudgetNumbers {
  rent: number;
  utilities: number;
  groceries: number;
  dining: number;
  transport: number;
  gym: number;
  monthlyTotal: number;
}

// Compute a monthly budget in GBP from a raw Zyla city payload.
//
// Rent, utilities, the restaurant meal price and gym come straight from the
// Zyla data. Groceries are built from a basket of staple item prices when the
// payload exposes them (Numbeo-style keys), and transport uses the monthly
// transit pass. Where a field is missing we fall back to a scale of the meal
// price so the number still tracks the city's real cost level. Everything is
// converted to GBP via the city's approximate FX rate.
export function computeBudget(raw: RawCity, def: CityDef): BudgetNumbers {
  const toGBP = (local: number): number => Math.round(local / def.perGBP);

  const rentLocal =
    findKey(raw, "1 Bedroom", "Outside") ||
    findKey(raw, "1 Bedroom", "City Centre") ||
    findKey(raw, "1 Bedroom");
  const rent = toGBP(rentLocal);

  const utilsBase = findKey(raw, "Basic Utilities") || findKey(raw, "Basic", "Electricity");
  const broadband = findKey(raw, "Broadband") || findKey(raw, "Internet");
  const utilities = utilsBase > 0 ? toGBP(utilsBase + broadband) : toGBP(broadband) || 0;

  const mealLocal = findKey(raw, "Inexpensive Restaurant") || findKey(raw, "Meal", "Inexpensive");
  const dining = toGBP(mealLocal);

  // Monthly grocery basket from staple item prices (local currency).
  const milk = findKey(raw, "Milk");
  const bread = findKey(raw, "Bread");
  const rice = findKey(raw, "Rice");
  const eggs = findKey(raw, "Eggs");
  const cheese = findKey(raw, "Local Cheese") || findKey(raw, "Cheese");
  const chicken = findKey(raw, "Chicken");
  const apples = findKey(raw, "Apples") || findKey(raw, "Apple");
  const banana = findKey(raw, "Banana");
  const tomato = findKey(raw, "Tomato");
  const potato = findKey(raw, "Potato");
  const water = findKey(raw, "Water", "1.5") || findKey(raw, "Water", "bottle");
  const basketLocal =
    milk * 20 +
    bread * 15 +
    rice * 5 +
    eggs * 2.5 +
    cheese * 1 +
    chicken * 4 +
    apples * 4 +
    banana * 4 +
    tomato * 5 +
    potato * 5 +
    water * 20;
  // Require a few staples to trust the basket; otherwise estimate from meals.
  const staplesPresent = [milk, bread, eggs, chicken].filter((n) => n > 0).length;
  const groceries = staplesPresent >= 3 ? toGBP(basketLocal) : Math.round(dining * 16);

  const transitLocal =
    findKey(raw, "Monthly Pass") || findKey(raw, "Monthly", "Transport") || findKey(raw, "Monthly Ticket");
  const transport = transitLocal > 0 ? toGBP(transitLocal) : Math.round(dining * 7);

  const gymLocal =
    findKey(raw, "Fitness Club", "Monthly") || findKey(raw, "Fitness Club") || findKey(raw, "Gym");
  const gym = gymLocal > 0 ? toGBP(gymLocal) : Math.round(dining * 2.5);

  const monthlyTotal = rent + utilities + groceries + dining * 8 + transport + gym;

  return { rent, utilities, groceries, dining, transport, gym, monthlyTotal };
}

export interface CityBudget {
  code: string;
  label: string;
  currency: string;
  budget: BudgetNumbers;
}

export interface CostOfLivingResponse {
  a: CityBudget;
  b: CityBudget;
  cachedUntil: string;
}

// List of comparable cities for the picker.
router.get("/cost-of-living/cities", (_req, res) => {
  res.json(
    CITIES.map((c) => ({ code: c.code, label: c.label, country: c.country })).sort((x, y) =>
      x.label.localeCompare(y.label),
    ),
  );
});

// Compare two cities: /cost-of-living?a=LON&b=HRG
router.get("/cost-of-living", async (req, res) => {
  const aCode = typeof req.query.a === "string" ? req.query.a.toUpperCase() : "LON";
  const bCode = typeof req.query.b === "string" ? req.query.b.toUpperCase() : "HRG";
  const aDef = CITY_BY_CODE.get(aCode);
  const bDef = CITY_BY_CODE.get(bCode);

  if (!aDef || !bDef) {
    res.status(400).json({ error: "Unknown city code", validCodes: CITIES.map((c) => c.code) });
    return;
  }

  try {
    const [aRaw, bRaw, fxRates] = await Promise.all([
      fetchCity(aDef),
      fetchCity(bDef),
      fetchFxRates(),
    ]);
    // Apply live FX (with per-city fallback) to each city definition.
    const aLive: CityDef = { ...aDef, perGBP: resolvePerGBP(aDef, fxRates) };
    const bLive: CityDef = { ...bDef, perGBP: resolvePerGBP(bDef, fxRates) };
    const result: CostOfLivingResponse = {
      a: { code: aDef.code, label: aDef.label, currency: aDef.currency, budget: computeBudget(aRaw, aLive) },
      b: { code: bDef.code, label: bDef.label, currency: bDef.currency, budget: computeBudget(bRaw, bLive) },
      cachedUntil: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    };
    res.json(result);
  } catch (err) {
    logger.error({ err, aCode, bCode }, "cost-of-living fetch failed");
    res.status(502).json({ error: "Failed to fetch cost of living data" });
  }
});

export default router;
