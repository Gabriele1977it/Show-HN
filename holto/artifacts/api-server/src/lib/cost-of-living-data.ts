// Curated cost-of-living dataset — the single source of truth for the compare
// tool. Every figure is a monthly cost in GBP for one person, EXCEPT `meal`,
// which is the price of a single inexpensive restaurant meal (the monthly total
// assumes ~8 meals out). Figures are grounded in public 2025–26 cost-of-living
// references (Numbeo-style city aggregates) and rounded to sensible round
// numbers, so they are honest estimates with correct relative levels between
// cities — not live-scraped precision.
//
// Why bundled rather than an API: the previous Zyla integration returned
// inconsistent, sometimes wildly wrong values (and didn't even carry cities like
// Delhi), which broke the core promise that our information is trustworthy. A
// curated, versioned dataset is deterministic, offline, free, and reviewable.
//
// To update: adjust the numbers below and bump DATA_VERSION. Keep values in GBP.

export const DATA_VERSION = "2026-01";

export interface CityCost {
  code: string;
  label: string;
  country: string;
  currency: string; // local currency (informational; all figures are GBP)
  rent: number; // 1-bedroom flat, monthly
  utilities: number; // electricity/water/heating + broadband, monthly
  groceries: number; // grocery basket for one, monthly
  meal: number; // one inexpensive restaurant meal
  transport: number; // monthly public-transport pass
  gym: number; // monthly gym membership
}

// Ordered roughly by region for easy review. The API sorts alphabetically.
export const CITY_COSTS: CityCost[] = [
  // — United Kingdom & Ireland —
  { code: "LON", label: "London", country: "united kingdom", currency: "GBP", rent: 1650, utilities: 210, groceries: 240, meal: 16, transport: 181, gym: 42 },
  { code: "DUB", label: "Dublin", country: "ireland", currency: "EUR", rent: 1800, utilities: 200, groceries: 230, meal: 17, transport: 90, gym: 45 },

  // — Iberia —
  { code: "LIS", label: "Lisbon", country: "portugal", currency: "EUR", rent: 900, utilities: 110, groceries: 180, meal: 11, transport: 40, gym: 38 },
  { code: "OPO", label: "Porto", country: "portugal", currency: "EUR", rent: 750, utilities: 105, groceries: 170, meal: 10, transport: 40, gym: 35 },
  { code: "BCN", label: "Barcelona", country: "spain", currency: "EUR", rent: 1050, utilities: 130, groceries: 200, meal: 13, transport: 40, gym: 42 },
  { code: "MAD", label: "Madrid", country: "spain", currency: "EUR", rent: 1050, utilities: 130, groceries: 200, meal: 13, transport: 55, gym: 40 },
  { code: "VLC", label: "Valencia", country: "spain", currency: "EUR", rent: 800, utilities: 120, groceries: 180, meal: 12, transport: 42, gym: 38 },

  // — Western & Central Europe —
  { code: "PAR", label: "Paris", country: "france", currency: "EUR", rent: 1300, utilities: 160, groceries: 240, meal: 16, transport: 86, gym: 38 },
  { code: "AMS", label: "Amsterdam", country: "netherlands", currency: "EUR", rent: 1650, utilities: 190, groceries: 220, meal: 18, transport: 100, gym: 35 },
  { code: "BER", label: "Berlin", country: "germany", currency: "EUR", rent: 1100, utilities: 250, groceries: 210, meal: 13, transport: 49, gym: 30 },
  { code: "ROM", label: "Rome", country: "italy", currency: "EUR", rent: 900, utilities: 170, groceries: 210, meal: 14, transport: 35, gym: 45 },
  { code: "MIL", label: "Milan", country: "italy", currency: "EUR", rent: 1150, utilities: 175, groceries: 220, meal: 15, transport: 39, gym: 50 },
  { code: "ATH", label: "Athens", country: "greece", currency: "EUR", rent: 500, utilities: 160, groceries: 180, meal: 12, transport: 30, gym: 40 },
  { code: "PRG", label: "Prague", country: "czech republic", currency: "CZK", rent: 750, utilities: 180, groceries: 170, meal: 8, transport: 20, gym: 30 },
  { code: "BUD", label: "Budapest", country: "hungary", currency: "HUF", rent: 550, utilities: 150, groceries: 150, meal: 7, transport: 25, gym: 30 },
  { code: "KRK", label: "Krakow", country: "poland", currency: "PLN", rent: 600, utilities: 160, groceries: 150, meal: 7, transport: 22, gym: 30 },
  { code: "IST", label: "Istanbul", country: "turkey", currency: "TRY", rent: 400, utilities: 60, groceries: 130, meal: 6, transport: 22, gym: 28 },

  // — North Africa & Middle East —
  { code: "HRG", label: "Hurghada", country: "egypt", currency: "EGP", rent: 170, utilities: 40, groceries: 90, meal: 4, transport: 15, gym: 22 },
  { code: "SSH", label: "Sharm el-Sheikh", country: "egypt", currency: "EGP", rent: 200, utilities: 45, groceries: 100, meal: 5, transport: 15, gym: 25 },
  { code: "CAI", label: "Cairo", country: "egypt", currency: "EGP", rent: 200, utilities: 40, groceries: 95, meal: 4, transport: 12, gym: 20 },
  { code: "RAK", label: "Marrakech", country: "morocco", currency: "MAD", rent: 300, utilities: 50, groceries: 130, meal: 5, transport: 15, gym: 25 },
  { code: "DXB", label: "Dubai", country: "united arab emirates", currency: "AED", rent: 1400, utilities: 150, groceries: 230, meal: 12, transport: 60, gym: 55 },

  // — South & Southeast Asia —
  { code: "DEL", label: "Delhi", country: "india", currency: "INR", rent: 200, utilities: 55, groceries: 95, meal: 3, transport: 15, gym: 18 },
  { code: "BOM", label: "Mumbai", country: "india", currency: "INR", rent: 350, utilities: 55, groceries: 110, meal: 3.5, transport: 15, gym: 22 },
  { code: "BLR", label: "Bengaluru", country: "india", currency: "INR", rent: 220, utilities: 50, groceries: 100, meal: 3, transport: 15, gym: 20 },
  { code: "BKK", label: "Bangkok", country: "thailand", currency: "THB", rent: 400, utilities: 60, groceries: 130, meal: 3, transport: 30, gym: 30 },
  { code: "DPS", label: "Bali (Denpasar)", country: "indonesia", currency: "IDR", rent: 350, utilities: 55, groceries: 120, meal: 3, transport: 15, gym: 35 },
  { code: "KUL", label: "Kuala Lumpur", country: "malaysia", currency: "MYR", rent: 350, utilities: 45, groceries: 120, meal: 3, transport: 25, gym: 35 },
  { code: "SIN", label: "Singapore", country: "singapore", currency: "SGD", rent: 1900, utilities: 150, groceries: 250, meal: 5, transport: 55, gym: 70 },
  { code: "SAI", label: "Ho Chi Minh City", country: "vietnam", currency: "VND", rent: 350, utilities: 55, groceries: 110, meal: 2.5, transport: 12, gym: 30 },

  // — East Asia —
  { code: "TYO", label: "Tokyo", country: "japan", currency: "JPY", rent: 900, utilities: 130, groceries: 240, meal: 6, transport: 60, gym: 60 },

  // — Africa (Sub-Saharan) & Caucasus —
  { code: "CPT", label: "Cape Town", country: "south africa", currency: "ZAR", rent: 550, utilities: 90, groceries: 170, meal: 9, transport: 40, gym: 35 },
  { code: "TBS", label: "Tbilisi", country: "georgia", currency: "GEL", rent: 400, utilities: 70, groceries: 130, meal: 6, transport: 10, gym: 30 },

  // — Americas & Oceania —
  { code: "NYC", label: "New York", country: "united states", currency: "USD", rent: 2800, utilities: 160, groceries: 300, meal: 20, transport: 108, gym: 60 },
  { code: "TOR", label: "Toronto", country: "canada", currency: "CAD", rent: 1500, utilities: 110, groceries: 250, meal: 16, transport: 90, gym: 40 },
  { code: "MEX", label: "Mexico City", country: "mexico", currency: "MXN", rent: 550, utilities: 45, groceries: 160, meal: 6, transport: 18, gym: 35 },
  { code: "SYD", label: "Sydney", country: "australia", currency: "AUD", rent: 1700, utilities: 140, groceries: 260, meal: 16, transport: 110, gym: 45 },
];
