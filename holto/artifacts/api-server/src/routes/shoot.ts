import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { computeLightWindows } from "../lib/solar";
import { geocodeConfigured, geocodePlace } from "../lib/geocode";

const router: IRouter = Router();

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function hhmm(localMin: number): string {
  const m = ((Math.round(localMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// "Best time to shoot" — deterministic golden/blue-hour windows for a place and
// date. Pure astronomy (no paid API); geocoding via Mapbox's free tier. Times
// are localised with a longitude-based approximation and labelled as such, since
// an exact tz-for-coordinates lookup isn't available for free.
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
  const offsetMin = Math.round(place.lng / 15) * 60; // approx local offset from longitude
  const win = (x: { start: number; end: number } | null) =>
    x ? { start: hhmm(x.start + offsetMin), end: hhmm(x.end + offsetMin) } : null;

  res.json({
    available: true,
    location: place.name,
    date: dateStr,
    polar: w.polar,
    sunrise: w.sunriseUtcMin != null ? hhmm(w.sunriseUtcMin + offsetMin) : null,
    sunset: w.sunsetUtcMin != null ? hhmm(w.sunsetUtcMin + offsetMin) : null,
    goldenMorning: win(w.goldenMorning),
    goldenEvening: win(w.goldenEvening),
    blueMorning: win(w.blueMorning),
    blueEvening: win(w.blueEvening),
    tzNote: "Times are in the destination's approximate local time — double-check against the local clock, especially around daylight-saving changes.",
  });
});

export default router;
