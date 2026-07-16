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

// A daily flight number returns several legs (yesterday, today, tomorrow). Pick
// the most relevant: prefer a leg that already carries a revised/estimated time
// (a live delay signal), otherwise the one whose scheduled departure is closest
// to now. Exported for testing.
export function pickBestLeg(list: AdbFlight[]): AdbFlight {
  const now = Date.now();
  const score = (f: AdbFlight): [number, number] => {
    const hasRevised = f.departure?.revisedTime?.utc || f.departure?.predictedTime?.utc ? 1 : 0;
    const sched = toIso(f.departure?.scheduledTime);
    const dist = sched ? Math.abs(Date.parse(sched) - now) : Number.MAX_SAFE_INTEGER;
    return [hasRevised, -dist]; // more revised first, then nearest scheduled
  };
  return [...list].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    return sb[0] - sa[0] || sb[1] - sa[1];
  })[0];
}

async function adbGet(path: string): Promise<unknown | null> {
  const key = process.env.AERODATABOX_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://${HOST}${path}`, {
      signal: AbortSignal.timeout(10000),
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST, accept: "application/json" },
    });
    if (!res.ok) {
      logger.warn({ status: res.status, path }, "AeroDataBox non-OK");
      return null;
    }
    return await res.json();
  } catch (err) {
    logger.warn({ err, path }, "AeroDataBox fetch failed");
    return null;
  }
}

// Build a ±`hours` airport-LOCAL datetime window ("yyyy-MM-ddTHH:mm") around a
// local scheduled time like "2026-07-16 09:30+01:00" — the format the live
// airport (FIDS) endpoint expects.
export function localWindow(localRaw: string, hours = 2): { from: string; to: string } | null {
  const m = localRaw.match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const base = new Date(`${m[1]}T${m[2]}:${m[3]}:00Z`).getTime();
  const fmt = (t: number) => new Date(t).toISOString().slice(0, 16);
  return { from: fmt(base - hours * 3_600_000), to: fmt(base + hours * 3_600_000) };
}

// Live departures board (FIDS) for an airport in a window — often carries the
// revised/estimated times that flight-by-number lacks. Finds our flight in the
// board. Returns null on any failure.
async function fetchFidsDeparture(iata: string, from: string, to: string, fn: string): Promise<Record<string, unknown> | null> {
  const path = `/flights/airports/iata/${encodeURIComponent(iata)}/${from}/${to}?direction=Departure&withLeg=true&withCancelled=true&withCodeshared=true&withCargo=false&withPrivate=false&withLocation=false`;
  const data = await adbGet(path);
  const list: AdbFlight[] = Array.isArray(data)
    ? (data as AdbFlight[])
    : Array.isArray((data as { departures?: AdbFlight[] })?.departures)
      ? (data as { departures?: AdbFlight[] }).departures!
      : [];
  const want = fn.replace(/\s+/g, "").toUpperCase();
  const hit = list.find((f) => (f.number ?? "").replace(/\s+/g, "").toUpperCase() === want);
  return hit ? normaliseAdbFlight(hit) : null;
}

// Fetch the current status for a flight number, or null on any failure. When the
// flight-by-number result has no live delay signal, cross-checks the live
// departures board for a revised time (disable with AERODATABOX_DISABLE_FIDS=1).
export async function fetchAeroDataBox(flightNumber: string): Promise<Record<string, unknown> | null> {
  if (!process.env.AERODATABOX_API_KEY) return null;
  const fn = flightNumber.trim().toUpperCase();
  const data = await adbGet(`/flights/number/${encodeURIComponent(fn)}?withLocation=false&withAircraftImage=false`);
  const list: AdbFlight[] = Array.isArray(data)
    ? (data as AdbFlight[])
    : Array.isArray((data as { flights?: AdbFlight[] })?.flights)
      ? (data as { flights?: AdbFlight[] }).flights!
      : data && typeof data === "object" && "number" in (data as object)
        ? [data as AdbFlight]
        : [];
  if (!list.length) return null;

  const best = pickBestLeg(list);
  const record = normaliseAdbFlight(best);

  // Enrich from the live departures board if we found no delay signal yet.
  const noSignal = !record.dep_estimated && !record.dep_actual;
  const iata = best.departure?.airport?.iata;
  const localRaw = best.departure?.scheduledTime?.local;
  if (noSignal && iata && localRaw && process.env.AERODATABOX_DISABLE_FIDS !== "1") {
    const win = localWindow(localRaw);
    if (win) {
      const fids = await fetchFidsDeparture(iata, win.from, win.to, fn);
      if (fids && (fids.dep_estimated || fids.dep_actual || fids.status === "delayed")) {
        return { ...record, ...fids };
      }
    }
  }
  return record;
}
