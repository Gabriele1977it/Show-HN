import { db, tripItemsTable, tripsTable } from "@workspace/db";
import { and, asc, eq, gte, isNotNull } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { buildFlightResponse, fetchFlightData, type FlightResponse } from "../lib/flights";
import { extractFlightNumber, extractRoute } from "../lib/journey-parse";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// A flight that departed up to this long ago is still "today's journey" — the
// traveller is mid-trip and may be at the gate or in the air.
const RECENT_DEPARTURE_MS = 3 * 60 * 60 * 1000;

// The single most relevant flight for the "travel day" view: the user's next
// flight timeline item, enriched (best effort) with live status. Free-tier:
// reuses the AirLabs lookup already behind /flights/status, and falls back to
// the itinerary's own times when live data isn't available.
router.get("/journey/next", requireAuth, async (req, res): Promise<void> => {
  const since = new Date(Date.now() - RECENT_DEPARTURE_MS);

  const [item] = await db
    .select({
      id: tripItemsTable.id,
      tripId: tripItemsTable.tripId,
      title: tripItemsTable.title,
      startAt: tripItemsTable.startAt,
      endAt: tripItemsTable.endAt,
      location: tripItemsTable.location,
      reference: tripItemsTable.reference,
      tripTitle: tripsTable.title,
    })
    .from(tripItemsTable)
    .innerJoin(tripsTable, eq(tripItemsTable.tripId, tripsTable.id))
    .where(
      and(
        eq(tripItemsTable.userId, req.auth!.userId),
        eq(tripItemsTable.type, "flight"),
        isNotNull(tripItemsTable.startAt),
        gte(tripItemsTable.startAt, since),
      ),
    )
    .orderBy(asc(tripItemsTable.startAt))
    .limit(1);

  if (!item) {
    res.json({ hasFlight: false });
    return;
  }

  const flightNumber = extractFlightNumber(item.title);
  const route = extractRoute(item.title);

  // Best-effort live enrichment — never let a lookup failure break the view.
  let live: FlightResponse | null = null;
  const apiKey = process.env.AIRLABS_API_KEY;
  if (apiKey && flightNumber) {
    try {
      const data = await fetchFlightData(flightNumber, apiKey);
      if (data) live = buildFlightResponse(flightNumber, data, null);
    } catch (err) {
      logger.warn({ err, flightNumber }, "journey live enrichment failed");
    }
  }

  res.json({
    hasFlight: true,
    flight: {
      tripItemId: item.id,
      tripId: item.tripId,
      tripTitle: item.tripTitle,
      title: item.title,
      flightNumber: flightNumber ?? live?.flightNumber ?? null,
      reference: item.reference,
      depAirport: live?.depAirport ?? route.dep ?? null,
      arrAirport: live?.arrAirport ?? route.arr ?? item.location ?? null,
      scheduledDep: live?.scheduledDep ?? item.startAt?.toISOString() ?? null,
      scheduledArr: live?.scheduledArr ?? item.endAt?.toISOString() ?? null,
      estimatedDep: live?.estimatedDep ?? null,
      status: live?.status ?? "scheduled",
      depGate: live?.depGate ?? null,
      depTerminal: live?.depTerminal ?? null,
      depDelay: live?.depDelay ?? null,
      live: !!live,
    },
  });
});

export default router;
