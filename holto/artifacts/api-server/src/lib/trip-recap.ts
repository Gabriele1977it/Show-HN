// Pure, dependency-free trip-recap maths. No DB imports, so it's unit-testable
// in isolation. Turns a trip's itinerary into the punchy stats behind a
// shareable "7 days · 3 countries · 2 flights" creator recap.

export interface RecapItem {
  type: string; // flight | hotel | train | car | activity | other
  title: string;
  location: string | null;
  startAt: string | null; // ISO timestamp
}

export interface TripRecapInput {
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  destination: string | null;
  items: RecapItem[];
}

export interface TripRecap {
  days: number | null;
  flights: number;
  stays: number;
  activities: number;
  places: number; // distinct cities
  countries: number; // distinct countries (derived from "City, Country" strings)
  cities: string[]; // ordered distinct city names, for display
}

function dayNumber(iso: string): number | null {
  const t = Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(t)) return null;
  return Math.floor(t / 86_400_000);
}

// "Lisbon, Portugal" → { city: "Lisbon", country: "Portugal" }; "Lisbon" → city only.
function splitPlace(raw: string): { city: string; country: string | null } {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts[0]!, country: parts[parts.length - 1]! };
  return { city: parts[0] ?? raw.trim(), country: null };
}

export function buildTripRecap(input: TripRecapInput): TripRecap {
  const items = input.items ?? [];

  const flights = items.filter((i) => i.type === "flight").length;
  const stays = items.filter((i) => i.type === "hotel").length;
  const activities = items.filter((i) => i.type === "activity").length;

  // Distinct cities/countries from item locations + the trip destination.
  const cityOrder: string[] = [];
  const citySet = new Set<string>();
  const countrySet = new Set<string>();
  const sources = [...items.map((i) => i.location), input.destination];
  for (const loc of sources) {
    if (!loc || !loc.trim()) continue;
    const { city, country } = splitPlace(loc);
    const key = city.toLowerCase();
    if (city && !citySet.has(key)) {
      citySet.add(key);
      cityOrder.push(city);
    }
    if (country) countrySet.add(country.toLowerCase());
  }

  // Trip length: explicit dates win; otherwise infer from the item timeline.
  let days: number | null = null;
  const startDay = input.startDate ? dayNumber(input.startDate) : null;
  const endDay = input.endDate ? dayNumber(input.endDate) : null;
  if (startDay != null && endDay != null && endDay >= startDay) {
    days = endDay - startDay + 1;
  } else {
    const dayNums = items.map((i) => (i.startAt ? dayNumber(i.startAt) : null)).filter((n): n is number => n != null);
    if (dayNums.length) {
      days = Math.max(...dayNums) - Math.min(...dayNums) + 1;
    }
  }

  return {
    days,
    flights,
    stays,
    activities,
    places: citySet.size,
    countries: countrySet.size,
    cities: cityOrder,
  };
}
