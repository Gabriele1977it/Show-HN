import { Router, type IRouter } from "express";

import { logger } from "../lib/logger";

const router: IRouter = Router();

const ZYLA_KEY = process.env.ZYLA_API_KEY ?? "";
const ZYLA_URL =
  "https://zylalabs.com/api/226/cities+cost+of+living+and+average+prices+api/3775/cost+of+living+by+city+v2";

const EGP_GBP = 1 / 77;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type RawCity = Record<string, string>;
const cache = new Map<string, { data: RawCity; ts: number }>();

const CITY_PARAMS: Record<string, { city: string; country: string }> = {
  HRG: { city: "hurghada", country: "egypt" },
  SSH: { city: "sharm el-sheikh", country: "egypt" },
  CAI: { city: "cairo", country: "egypt" },
  LON: { city: "london", country: "united kingdom" },
};

async function fetchCity(code: string): Promise<RawCity> {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  const { city, country } = CITY_PARAMS[code] ?? { city: code, country: "" };
  const url = `${ZYLA_URL}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ZYLA_KEY}` },
  });
  if (!res.ok) throw new Error(`Zyla ${code}: HTTP ${res.status}`);
  const data = (await res.json()) as RawCity;
  if (!Object.keys(data).length) {
    throw new Error(`Zyla ${code}: empty response`);
  }
  cache.set(code, { data, ts: Date.now() });
  return data;
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

function toGBP(n: number, isEgp: boolean): number {
  return Math.round(isEgp ? n * EGP_GBP : n);
}

const STATIC_FOOD: Record<string, number> = { HRG: 100, SSH: 130, CAI: 90, LON: 380 };
const STATIC_HEALTH: Record<string, number> = { HRG: 25, SSH: 30, CAI: 35, LON: 120 };
const STATIC_TRANSPORT: Record<string, number> = { HRG: 20, SSH: 25, CAI: 15, LON: 200 };
const STATIC_MISC: Record<string, number> = { HRG: 40, SSH: 50, CAI: 40, LON: 160 };
const STATIC_GYM: Record<string, number> = { HRG: 18, SSH: 20, CAI: 15, LON: 54 };

export interface BudgetNumbers {
  rent: number;
  utilities: number;
  food: number;
  dining: number;
  healthcare: number;
  gym: number;
  monthlyTotal: number;
}

function computeBudget(raw: RawCity, code: string, isEgp: boolean): BudgetNumbers {
  const isResort = code === "HRG" || code === "SSH";

  const rent = toGBP(
    isEgp
      ? (isResort
          ? findKey(raw, "1 Bedroom", "City Centre") || findKey(raw, "1 Bedroom", "Outside")
          : findKey(raw, "1 Bedroom", "Outside") || findKey(raw, "1 Bedroom", "City Centre"))
      : findKey(raw, "1 Bedroom", "Outside") || findKey(raw, "1 Bedroom", "City Centre"),
    isEgp,
  );

  const utilsBase = findKey(raw, "Basic Utilities");
  const broadband = findKey(raw, "Broadband");
  // Only combine when "Basic Utilities" exists; otherwise broadband alone is incomplete
  const utilities = utilsBase > 0
    ? toGBP(utilsBase + broadband, isEgp)
    : isEgp
    ? (broadband > 0 ? toGBP(broadband, isEgp) + 25 : 22)
    : 290;

  const dining = toGBP(findKey(raw, "Inexpensive Restaurant"), isEgp);

  const gymRaw =
    findKey(raw, "Fitness Club", "Monthly") ||
    findKey(raw, "Fitness Club") ||
    findKey(raw, "Monthly Fitness");
  const gym = gymRaw > 0 ? toGBP(gymRaw, isEgp) : (STATIC_GYM[code] ?? 18);

  const food = STATIC_FOOD[code] ?? 100;
  const healthcare = STATIC_HEALTH[code] ?? 30;
  const transport = STATIC_TRANSPORT[code] ?? 50;
  const misc = STATIC_MISC[code] ?? 50;

  const monthlyTotal = rent + utilities + food + dining * 8 + gym + transport + misc;

  return { rent, utilities, food, dining, healthcare, gym, monthlyTotal };
}

export interface CostOfLivingData {
  HRG: BudgetNumbers;
  SSH: BudgetNumbers;
  CAI: BudgetNumbers;
  LON: BudgetNumbers;
  cachedUntil: string;
}

router.get("/cost-of-living", async (req, res) => {
  try {
    const [hrg, ssh, cai, lon] = await Promise.all([
      fetchCity("HRG"),
      fetchCity("SSH"),
      fetchCity("CAI"),
      fetchCity("LON"),
    ]);

    const result: CostOfLivingData = {
      HRG: computeBudget(hrg, "HRG", true),
      SSH: computeBudget(ssh, "SSH", true),
      CAI: computeBudget(cai, "CAI", true),
      LON: computeBudget(lon, "LON", false),
      cachedUntil: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    };

    res.json(result);
  } catch (err) {
    logger.error({ err }, "cost-of-living fetch failed");
    res.status(502).json({ error: "Failed to fetch cost of living data" });
  }
});

export default router;
