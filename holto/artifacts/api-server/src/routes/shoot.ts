import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { computeLightWindows } from "../lib/solar";
import { geocodeConfigured, geocodePlace } from "../lib/geocode";
import { zoneFor, utcMinToLocalHHMM, utcOffsetLabel } from "../lib/timezone";

const router: IRouter = Router();

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// "Best time to shoot" — deterministic golden/blue-hour windows for a place and
// date. Pure astronomy (no paid API); geocoding via Mapbox's free tier. Times
// are localised to the destination's real IANA timezone (offline tz-lookup),
// with DST applied for the exact date via Intl — accurate to the minute.
router.get("/shoot-times", requireAuth, async (req, res): Promise<void> => {
  const location = String(req.query.location ?? "").trim();
  if (!location) {
    res.status(400).json({ error: "Enter a place (e.g. Lisbon, or Sagrada Familia)." });
    return;
  }

  const dateStr = String(req.query.date ?? "").trim() || new Date().toISOString().slice(0, 10);
  const m = ISO_DATE.exec(dateStr);
  if (!m) {
    res.status(400).json({ error: "Date must be YYYY-MM-DD." });
    return;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  if (!geocodeConfigured()) {
    res.json({ available: false, reason: "geocoding_unavailable" });
    return;
  }

  const place = await geocodePlace(location);
  if (!place) {
    res.status(404).json({ error: `Couldn't find “${location}”. Try a city or landmark name.` });
    return;
  }

  const w = computeLightWindows(y, mo, d, place.lat, place.lng);

  // Real timezone for the coordinates. If the lookup ever fails, fall back to a
  // longitude-based whole-hour offset so we still return something usable.
  const zone = zoneFor(place.lat, place.lng);
  const toLocal = (utcMin: number): string => {
    if (zone) return utcMinToLocalHHMM(y, mo, d, utcMin, zone);
    const m = (((Math.round(utcMin + Math.round(place.lng / 15) * 60)) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  const win = (x: { start: number; end: number } | null) =>
    x ? { start: toLocal(x.start), end: toLocal(x.end) } : null;

  const offsetLabel = zone ? utcOffsetLabel(y, mo, d, zone) : null;

  res.json({
    available: true,
    location: place.name,
    date: dateStr,
    polar: w.polar,
    timezone: zone,
    utcOffset: offsetLabel,
    sunrise: w.sunriseUtcMin != null ? toLocal(w.sunriseUtcMin) : null,
    sunset: w.sunsetUtcMin != null ? toLocal(w.sunsetUtcMin) : null,
    goldenMorning: win(w.goldenMorning),
    goldenEvening: win(w.goldenEvening),
    blueMorning: win(w.blueMorning),
    blueEvening: win(w.blueEvening),
    tzNote: zone
      ? `Times shown in ${zone.replace(/_/g, " ")} local time (${offsetLabel}), with daylight saving applied for this date.`
      : "Times are in the destination's approximate local time — double-check against the local clock.",
  });
});

export default router;
