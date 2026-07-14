import tzlookup from "tz-lookup";

// Turn coordinates into a real IANA timezone (e.g. "Europe/London",
// "Asia/Kolkata") and convert solar UTC-minutes into the destination's exact
// local clock. This replaces the old longitude-based approximation, which
// ignored political time zones (India is UTC+5:30, not a whole hour) and
// daylight saving (London is UTC+1 in summer, UTC+0 in winter). tz-lookup is a
// fully offline dataset, and Intl.DateTimeFormat applies each zone's real DST
// rules for the specific date — so the times are accurate to the minute.

// The IANA zone name for a coordinate, or null if the lookup fails.
export function zoneFor(lat: number, lng: number): string | null {
  try {
    return tzlookup(lat, lng);
  } catch {
    return null;
  }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = fmtCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false });
    fmtCache.set(zone, f);
  }
  return f;
}

// Convert "minutes from UTC midnight on this date" into local "HH:MM" for the
// given zone, honouring that zone's DST offset for that exact instant.
export function utcMinToLocalHHMM(year: number, month: number, day: number, utcMin: number, zone: string): string {
  const instant = Date.UTC(year, month - 1, day, 0, 0) + Math.round(utcMin) * 60_000;
  const parts = formatter(zone).formatToParts(new Date(instant));
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const min = parts.find((p) => p.type === "minute")?.value ?? "00";
  // en-GB can emit "24" for midnight; normalise to "00".
  return `${h === "24" ? "00" : h}:${min}`;
}

// A friendly UTC offset label for the zone on this date, e.g. "UTC+1", "UTC+5:30".
export function utcOffsetLabel(year: number, month: number, day: number, zone: string): string {
  // Noon UTC on the date is a safe reference instant well clear of DST edges.
  const instant = Date.UTC(year, month - 1, day, 12, 0);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(
    new Date(instant),
  );
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  // Intl emits e.g. "GMT+5:30" or "GMT+0" — present it as "UTC+5:30" / "UTC".
  const label = name.replace(/^GMT/, "UTC") || "UTC";
  return label === "UTC+0" ? "UTC" : label;
}
