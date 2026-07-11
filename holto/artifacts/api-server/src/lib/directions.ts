import { logger } from "./logger";

// Live driving time (with current traffic) between two places via the Google
// Directions API. Returns null when the key is missing, the request fails, or
// no route is found, so callers can fall back to manual entry.

const KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

export interface DriveEstimate {
  minutes: number;
  distanceText: string;
  durationText: string;
}

export async function getDriveEstimate(origin: string, destination: string): Promise<DriveEstimate | null> {
  if (!KEY) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("departure_time", "now"); // enables traffic-aware duration
  url.searchParams.set("traffic_model", "best_guess");
  url.searchParams.set("key", KEY);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Directions HTTP ${res.status}`);
    const json = (await res.json()) as {
      status?: string;
      routes?: Array<{ legs?: Array<{ duration_in_traffic?: { value: number; text: string }; duration?: { value: number; text: string }; distance?: { text: string } }> }>;
    };
    if (json.status !== "OK" || !json.routes?.length) {
      logger.warn({ status: json.status }, "Directions returned no route");
      return null;
    }
    const leg = json.routes[0]?.legs?.[0];
    const dur = leg?.duration_in_traffic ?? leg?.duration;
    if (!dur) return null;
    return {
      minutes: Math.round(dur.value / 60),
      distanceText: leg?.distance?.text ?? "",
      durationText: dur.text,
    };
  } catch (err) {
    logger.warn({ err }, "Directions request failed");
    return null;
  }
}
