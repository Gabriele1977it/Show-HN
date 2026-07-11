import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { computeLeaveTime, minutesUntil, type TripType } from "../lib/airport-timing";
import { configuredProviders, getDriveEstimate, type Destination } from "../lib/directions";
import { lookupAirport } from "../lib/airports";

const router: IRouter = Router();

// Public health check: shows whether a maps provider key reached the server
// (booleans only — no secrets). Handy for confirming MAPBOX_TOKEN is live.
router.get("/airport/config", (_req, res) => {
  res.json(configuredProviders());
});

// Work out when to leave for the airport. Drive time comes from Google
// Directions (live traffic) when an origin + airport are given; the caller can
// also pass driveMinutes directly (e.g. if Maps is unavailable).
router.post("/airport/leave-time", requireAuth, async (req, res): Promise<void> => {
  const { departureAt, tripType, origin, airport, driveMinutes } = req.body as {
    departureAt?: string;
    tripType?: string;
    origin?: string;
    airport?: string;
    driveMinutes?: number;
  };

  if (!departureAt || Number.isNaN(new Date(departureAt).getTime())) {
    res.status(400).json({ error: "A valid departureAt (ISO datetime) is required" });
    return;
  }
  const trip: TripType = tripType === "domestic" ? "domestic" : "international";

  // Prefer an explicit driveMinutes; otherwise fetch a live estimate.
  let drive = typeof driveMinutes === "number" && driveMinutes >= 0 ? Math.round(driveMinutes) : null;
  let driveSource: "manual" | "live" | null = drive !== null ? "manual" : null;
  let distanceText = "";
  let durationText = "";

  if (drive === null && origin?.trim() && airport?.trim()) {
    // Resolve the airport to precise coordinates when we know the IATA code;
    // otherwise fall back to a text query for the geocoder.
    const coord = /^[A-Za-z]{3}$/.test(airport.trim()) ? lookupAirport(airport.trim()) : null;
    const dest: Destination = coord ?? (/^[A-Za-z]{3}$/.test(airport.trim()) ? `${airport.trim().toUpperCase()} airport` : airport.trim());
    const est = await getDriveEstimate(origin.trim(), dest);
    if (est) {
      drive = est.minutes;
      driveSource = "live";
      distanceText = est.distanceText;
      durationText = est.durationText;
    }
  }

  if (drive === null) {
    // Can't determine drive time — tell the client why so it can ask the user
    // to enter their drive time manually (and so we can diagnose).
    const providers = configuredProviders();
    res.json({
      ok: false,
      reason: !providers.mapbox && !providers.google ? "no_provider" : "route_failed",
      providers,
      tripType: trip,
      recommendedArrivalMinutes: trip === "international" ? 180 : 120,
    });
    return;
  }

  const result = computeLeaveTime({ departureAt, driveMinutes: drive, tripType: trip });
  if (!result) {
    res.status(400).json({ error: "Could not compute leave time" });
    return;
  }

  const now = new Date().toISOString();
  res.json({
    ok: true,
    tripType: trip,
    driveSource,
    distanceText,
    durationText,
    minutesUntilLeave: minutesUntil(result.leaveBy, now),
    ...result,
  });
});

export default router;
