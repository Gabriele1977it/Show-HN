import { logger } from "./logger";

// World Bank "price level ratio of PPP conversion factor (GDP) to market
// exchange rate" — indicator PA.NUS.PPPC.RF. A value of ~1.0 means the
// country's overall price level matches the global benchmark; lower is cheaper.
// It is a free, authoritative, no-key dataset, so we use it to give the cost-of-
// living tool a real, citable anchor for how expensive each country is overall.
//
// Note this measures a GDP-wide basket (all goods and services), which is a
// different thing from a traveller's rent-and-meals basket — so we surface it
// as an independent cross-check alongside our estimated breakdown, rather than
// overwriting our figures with it.

const WB_INDICATOR = "PA.NUS.PPPC.RF";

// Exact country strings used in the cost-of-living dataset → ISO-3166 alpha-3,
// which is what the World Bank API keys on.
export const COUNTRY_ISO3: Record<string, string> = {
  "united kingdom": "GBR",
  ireland: "IRL",
  portugal: "PRT",
  spain: "ESP",
  france: "FRA",
  netherlands: "NLD",
  germany: "DEU",
  italy: "ITA",
  greece: "GRC",
  "czech republic": "CZE",
  hungary: "HUN",
  poland: "POL",
  turkey: "TUR",
  egypt: "EGY",
  morocco: "MAR",
  "united arab emirates": "ARE",
  india: "IND",
  thailand: "THA",
  indonesia: "IDN",
  malaysia: "MYS",
  singapore: "SGP",
  vietnam: "VNM",
  japan: "JPN",
  "south africa": "ZAF",
  georgia: "GEO",
  "united states": "USA",
  canada: "CAN",
  mexico: "MEX",
  australia: "AUS",
};

// Offline fallback: approximate recent PA.NUS.PPPC.RF values. These are used
// ONLY when the live World Bank API can't be reached (or before the first
// successful fetch). In production the live values override them and are cached,
// so the numbers users see are the real, current World Bank figures.
export const WB_SNAPSHOT: Record<string, number> = {
  GBR: 0.98, IRL: 1.10, PRT: 0.62, ESP: 0.66, FRA: 0.87, NLD: 0.9, DEU: 0.85,
  ITA: 0.72, GRC: 0.6, CZE: 0.55, HUN: 0.5, POL: 0.5, TUR: 0.28, EGY: 0.22,
  MAR: 0.42, ARE: 0.72, IND: 0.25, THA: 0.42, IDN: 0.37, MYS: 0.45, SGP: 0.85,
  VNM: 0.38, JPN: 0.85, ZAF: 0.42, GEO: 0.38, USA: 1.0, CAN: 0.98, MEX: 0.6,
  AUS: 1.05,
};
export const WB_SNAPSHOT_YEAR = 2023;

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // WB data updates roughly annually
let cache: { ratios: Record<string, number>; year: number; live: boolean; ts: number } | null = null;

interface WbRow {
  countryiso3code?: string;
  date?: string;
  value?: number | null;
}

// Fetch the latest price-level ratio for every country at once (one request),
// falling back to the bundled snapshot on any failure. Never throws.
export async function getPriceLevels(): Promise<{ ratios: Record<string, number>; year: number; live: boolean }> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache;

  const isos = Object.values(COUNTRY_ISO3).join(";");
  const url = `https://api.worldbank.org/v2/country/${isos}/indicator/${WB_INDICATOR}?format=json&per_page=600&mrnev=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`World Bank HTTP ${res.status}`);
    const json = (await res.json()) as [unknown, WbRow[] | null];
    const rows = Array.isArray(json) ? json[1] : null;
    if (!rows || !rows.length) throw new Error("World Bank empty payload");

    const ratios: Record<string, number> = {};
    let year = 0;
    for (const r of rows) {
      if (r.countryiso3code && typeof r.value === "number" && r.value > 0) {
        ratios[r.countryiso3code] = r.value;
        const y = Number(r.date);
        if (y > year) year = y;
      }
    }
    // Backfill any country the live feed didn't return, from the snapshot.
    for (const [iso, v] of Object.entries(WB_SNAPSHOT)) if (!(iso in ratios)) ratios[iso] = v;

    cache = { ratios, year: year || WB_SNAPSHOT_YEAR, live: true, ts: Date.now() };
    return cache;
  } catch (err) {
    logger.warn({ err }, "World Bank price-level fetch failed; using bundled snapshot");
    cache = { ratios: { ...WB_SNAPSHOT }, year: WB_SNAPSHOT_YEAR, live: false, ts: Date.now() };
    return cache;
  }
}

// Country overall price level indexed so the United Kingdom = 100. Returns null
// if we have no data for the country (e.g. an unmapped one).
export function priceIndexUK100(iso: string, ratios: Record<string, number>): number | null {
  const base = ratios.GBR;
  const v = ratios[iso];
  if (!base || !v) return null;
  return Math.round((100 * v) / base);
}
