import { logger } from "./logger";

// Optional second flight-status provider: AeroDataBox (via RapidAPI). It has
// notably better *pre-departure* delay coverage than AirLabs' free tier, so we
// use it as a cross-check — when configured, its signal is merged with AirLabs
// and the more-disrupted / more-informative view wins (see lib/flights.ts).
//
// Entirely dormant until AERODATABOX_API_KEY is set: no key ⇒ no calls, no cost,
// no behaviour change. Free/cheap RapidAPI tiers exist; the app never assumes it.

const HOST = process.env.AERODATABOX_API_HOST?.trim() || "aerodatabox.p.rapidapi.com";

export function aerodataboxConfigured(): boolean {
  return !!process.env.AERODATABOX_API_KEY;
}

interface AdbTime {
  utc?: string;
  local?: string;
}
interface AdbMovement {
  airport?: { iata?: string };
  scheduledTime?: AdbTime;
  revisedTime?: AdbTime;
  predictedTime?: AdbTime;
  runwayTime?: AdbTime;
  terminal?: string;
  gate?: string;
}
interface AdbFlight {
  number?: string;
  status?: string;
  airline?: { iata?: string };
  departure?: AdbMovement;
  arrival?: AdbMovement;
}

// AeroDataBox emits "2026-07-15 17:10Z"; normalise to an ISO string Date can parse.
function toIso(t: AdbTime | undefined): string | null {
  const raw = t?.utc ?? t?.local;
  if (!raw) return null;
  const iso = raw.trim().replace(" ", "T");
  return Number.isNaN(Date.parse(iso)) ? null : new Date(iso).toISOString();
}

// Map AeroDataBox's status vocabulary onto the strings our mapStatus understands.
function mapAdbStatus(s: string | undefined): string {
  switch ((s ?? "").toLowerCase()) {
    case "canceled":
    case "cancelled":
    case "canceleduncertain":
      return "cancelled";
    case "diverted":
      return "diverted";
    case "delayed":
      return "delayed";
    case "departed":
    case "enroute":
    case "en route":
    case "approaching":
      return "active";
    case "arrived":
      return "landed";
    case "expected":
    case "checkin":
    case "boarding":
    case "gateclosed":
    case "scheduled":
      return "scheduled";
    default:
      return "unknown";
  }
}

// Flatten an AeroDataBox flight into the same shape the AirLabs path produces,
// so the two can be merged uniformly downstream.
export function normaliseAdbFlight(f: AdbFlight): Record<string, unknown> {
  const dep = f.departure ?? {};
  const arr = f.arrival ?? {};
  return {
    flight_iata: (f.number ?? "").replace(/\s+/g, "") || null,
    airline_iata: f.airline?.iata ?? null,
    status: mapAdbStatus(f.status),
    dep_iata: dep.airport?.iata ?? null,
    arr_iata: arr.airport?.iata ?? null,
    dep_time: toIso(dep.scheduledTime),
    dep_estimated: toIso(dep.revisedTime ?? dep.predictedTime),
    dep_actual: toIso(dep.runwayTime),
    arr_time: toIso(arr.scheduledTime),
    arr_estimated: toIso(arr.revisedTime ?? arr.predictedTime),
    arr_actual: toIso(arr.runwayTime),
    dep_gate: dep.gate ?? null,
    dep_terminal: dep.terminal ?? null,
    arr_terminal: arr.terminal ?? null,
    dep_delay: null, // derived from times downstream
    arr_delay: null,
  };
}

// Fetch the current status for a flight number, or null on any failure.
export async function fetchAeroDataBox(flightNumber: string): Promise<Record<string, unknown> | null> {
  const key = process.env.AERODATABOX_API_KEY;
  if (!key) return null;
  const fn = flightNumber.trim().toUpperCase();
  const url = `https://${HOST}/flights/number/${encodeURIComponent(fn)}?withLocation=false&withAircraftImage=false`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST, accept: "application/json" },
    });
    if (!res.ok) {
      logger.warn({ status: res.status, fn }, "AeroDataBox non-OK");
      return null;
    }
    const data = (await res.json()) as AdbFlight[] | { flights?: AdbFlight[] } | AdbFlight;
    const list: AdbFlight[] = Array.isArray(data)
      ? data
      : Array.isArray((data as { flights?: AdbFlight[] }).flights)
        ? (data as { flights?: AdbFlight[] }).flights!
        : data && typeof data === "object" && "number" in data
          ? [data as AdbFlight]
          : [];
    if (!list.length) return null;
    // Prefer the leg with a real departure time closest to now; simplest robust
    // choice is the first, which AeroDataBox returns for the nearest date.
    return normaliseAdbFlight(list[0]);
  } catch (err) {
    logger.warn({ err, fn }, "AeroDataBox fetch failed");
    return null;
  }
}
