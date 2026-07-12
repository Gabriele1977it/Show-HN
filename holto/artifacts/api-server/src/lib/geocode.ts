import { logger } from "./logger";

// Resolve a free-text place ("Lisbon", "Sagrada Familia", "Bali") to coordinates
// via Mapbox's free geocoding tier. Returns null when nothing is configured or
// the lookup fails, so callers can degrade gracefully.

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN ?? "";

export function geocodeConfigured(): boolean {
  return Boolean(MAPBOX_TOKEN);
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  name: string; // resolved place name, e.g. "Lisbon, Portugal"
}

export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q || !MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Mapbox geocode HTTP ${res.status}`);
    const json = (await res.json()) as { features?: Array<{ center?: [number, number]; place_name?: string }> };
    const f = json.features?.[0];
    if (!f?.center || f.center.length !== 2) return null;
    return { lat: f.center[1]!, lng: f.center[0]!, name: f.place_name ?? q };
  } catch (err) {
    logger.warn({ err, query: q }, "geocodePlace failed");
    return null;
  }
}
