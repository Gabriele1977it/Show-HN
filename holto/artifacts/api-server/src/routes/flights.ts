import { db, monitoredFlightsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { buildFlightResponse, fetchFlightData, generateStatusMessage } from "../lib/flights";

const router: IRouter = Router();

router.get("/flights/status", requireAuth, async (req, res): Promise<void> => {
  const flightNumber = (req.query.flightNumber as string)?.trim().toUpperCase();
  if (!flightNumber) {
    res.status(400).json({ error: "Flight number is required (e.g. EZY8743)." });
    return;
  }

  const apiKey = process.env.AIRLABS_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Flight tracking is not configured." });
    return;
  }

  req.log.info({ flightNumber }, "Fetching flight status");
  const flight = await fetchFlightData(flightNumber, apiKey);

  if (!flight) {
    req.log.warn({ flightNumber }, "Flight not found in any AirLabs endpoint");
    res.status(404).json({
      error: `Flight ${flightNumber} not found. It may not be in the database yet — try again closer to the departure date, or check the flight number is correct.`,
    });
    return;
  }

  const companionMessage = await generateStatusMessage(flight);
  res.json(buildFlightResponse(flightNumber, flight, companionMessage));
});

router.get("/flights/monitor", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(monitoredFlightsTable)
    .where(and(eq(monitoredFlightsTable.userId, req.auth!.userId), eq(monitoredFlightsTable.active, true)))
    .orderBy(desc(monitoredFlightsTable.createdAt));

  res.json(
    rows.map((r) => ({
      id: r.id,
      flightNumber: r.flightNumber,
      destination: r.destination,
      lastStatus: r.lastStatus ?? null,
      lastCheckedAt: r.lastCheckedAt ?? null,
      createdAt: r.createdAt,
    })),
  );
});

router.post("/flights/monitor", requireAuth, async (req, res): Promise<void> => {
  const { flightNumber, destination } = req.body as { flightNumber?: string; destination?: string };

  if (!flightNumber?.trim() || !destination?.trim()) {
    res.status(400).json({ error: "Flight number and destination are required." });
    return;
  }

  const [row] = await db
    .insert(monitoredFlightsTable)
    .values({
      userId: req.auth!.userId,
      flightNumber: flightNumber.trim().toUpperCase(),
      destination: destination.trim().toUpperCase(),
      active: true,
    })
    .returning();

  res.status(201).json({
    id: row.id,
    flightNumber: row.flightNumber,
    destination: row.destination,
    lastStatus: row.lastStatus ?? null,
    lastCheckedAt: row.lastCheckedAt ?? null,
    createdAt: row.createdAt,
  });
});

router.delete("/flights/monitor/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }

  const [row] = await db
    .update(monitoredFlightsTable)
    .set({ active: false })
    .where(and(eq(monitoredFlightsTable.id, id), eq(monitoredFlightsTable.userId, req.auth!.userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Monitored flight not found." });
    return;
  }

  res.status(204).send();
});

export default router;
