import { logger } from "./logger";

// Live driving time (with current traffic) between two places. Prefers Mapbox's
// free tier (no billing account required, traffic-aware "driving-traffic"
// profile); falls back to Google Directions if that's the configured key.
// Returns null when nothing is configured or the request fails, so callers can
// fall back to manual entry.

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN ?? "";
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

export interface DriveEstimate {
  minutes: number;
  distanceText: string;
  durationText: string;
  provider: "mapbox" | "google";
}

export type Destination = string | { lat: number; lon: number };

export function configuredProviders(): { mapbox: boolean; google: boolean } {
  return { mapbox: Boolean(MAPBOX_TOKEN), google: Boolean(GOOGLE_KEY) };
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}
function fmtDistanceKm(meters: number): string {
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

// ── Mapbox (free tier) ──────────────────────────────────────────────────────
async function geocodeMapbox(query: string): Promise<[number, number] | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Mapbox geocode HTTP ${res.status}`);
  const json = (await res.json()) as { features?: Array<{ center?: [number, number] }> };
  const center = json.features?.[0]?.center;
  return center && center.length === 2 ? center : null;
}

async function mapboxDrive(origin: string, destination: Destination): Promise<DriveEstimate | null> {
  const a = await geocodeMapbox(origin);
  const b = typeof destination === "string" ? await geocodeMapbox(destination) : ([destination.lon, destination.lat] as [number, number]);
  if (!a || !b) return null;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${a[0]},${a[1]};${b[0]},${b[1]}?access_token=${MAPBOX_TOKEN}&overview=false`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Mapbox directions HTTP ${res.status}`);
  const json = (await res.json()) as { routes?: Array<{ duration?: number; distance?: number }> };
  const route = json.routes?.[0];
  if (!route?.duration) return null;
  const minutes = Math.round(route.duration / 60);
  return { minutes, durationText: fmtDuration(minutes), distanceText: route.distance ? fmtDistanceKm(route.distance) : "", provider: "mapbox" };
}

// ── Google (fallback) ───────────────────────────────────────────────────────
async function googleDrive(origin: string, destination: Destination): Promise<DriveEstimate | null> {
  const dest = typeof destination === "string" ? destination : `${destination.lat},${destination.lon}`;
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", dest);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("departure_time", "now");
  url.searchParams.set("traffic_model", "best_guess");
  url.searchParams.set("key", GOOGLE_KEY);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Directions HTTP ${res.status}`);
  const json = (await res.json()) as {
    status?: string;
    routes?: Array<{ legs?: Array<{ duration_in_traffic?: { value: number; text: string }; duration?: { value: number; text: string }; distance?: { text: string } }> }>;
  };
  if (json.status !== "OK" || !json.routes?.length) return null;
  const leg = json.routes[0]?.legs?.[0];
  const dur = leg?.duration_in_traffic ?? leg?.duration;
  if (!dur) return null;
  return { minutes: Math.round(dur.value / 60), distanceText: leg?.distance?.text ?? "", durationText: dur.text, provider: "google" };
}

export async function getDriveEstimate(origin: string, destination: Destination): Promise<DriveEstimate | null> {
  try {
    if (MAPBOX_TOKEN) return await mapboxDrive(origin, destination);
    if (GOOGLE_KEY) return await googleDrive(origin, destination);
    return null;
  } catch (err) {
    logger.warn({ err }, "drive estimate failed");
    return null;
  }
}
