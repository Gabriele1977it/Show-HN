import { db, tripItemsTable, tripsTable } from "@workspace/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { parseTripFromText } from "../lib/trip-parse";

const router: IRouter = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ITEM_TYPES = new Set(["flight", "hotel", "train", "car", "activity", "other"]);

function parseId(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(v ?? "", 10);
}

// List the user's trips, each with its items sorted along the timeline.
router.get("/trips", requireAuth, async (req, res): Promise<void> => {
  const trips = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.userId, req.auth!.userId))
    .orderBy(desc(tripsTable.startDate));

  const tripIds = trips.map((t) => t.id);
  const items = tripIds.length
    ? await db
        .select()
        .from(tripItemsTable)
        .where(inArray(tripItemsTable.tripId, tripIds))
        .orderBy(asc(tripItemsTable.startAt))
    : [];

  const byTrip = new Map<number, typeof items>();
  for (const it of items) {
    const list = byTrip.get(it.tripId) ?? [];
    list.push(it);
    byTrip.set(it.tripId, list);
  }

  res.json(trips.map((t) => ({ ...t, items: byTrip.get(t.id) ?? [] })));
});

router.post("/trips", requireAuth, async (req, res): Promise<void> => {
  const { title, destination, startDate, endDate } = req.body as {
    title?: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
  };
  if (!title?.trim()) {
    res.status(400).json({ error: "A trip title is required" });
    return;
  }
  if (startDate && !ISO_DATE.test(startDate)) {
    res.status(400).json({ error: "startDate must be YYYY-MM-DD" });
    return;
  }
  if (endDate && !ISO_DATE.test(endDate)) {
    res.status(400).json({ error: "endDate must be YYYY-MM-DD" });
    return;
  }
  if (startDate && endDate && endDate < startDate) {
    res.status(400).json({ error: "endDate cannot be before startDate" });
    return;
  }

  const [trip] = await db
    .insert(tripsTable)
    .values({
      userId: req.auth!.userId,
      title: title.trim(),
      destination: destination?.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
    })
    .returning();

  res.status(201).json({ ...trip, items: [] });
});

// Paste a booking confirmation → parse it into a trip with items (uses the
// existing OpenAI key; no third-party email service needed).
router.post("/trips/parse", requireAuth, async (req, res): Promise<void> => {
  const { text } = req.body as { text?: string };
  if (!text?.trim() || text.trim().length < 15) {
    res.status(400).json({ error: "Paste the full booking confirmation text." });
    return;
  }

  const parsed = await parseTripFromText(text);
  if (!parsed) {
    res.status(422).json({ error: "Couldn't find a booking in that text. Try adding it manually." });
    return;
  }

  const [trip] = await db
    .insert(tripsTable)
    .values({
      userId: req.auth!.userId,
      title: parsed.title,
      destination: parsed.destination,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
    })
    .returning();

  const itemsToInsert = parsed.items.map((it) => ({
    tripId: trip.id,
    userId: req.auth!.userId,
    type: it.type,
    title: it.title,
    startAt: it.startAt ? new Date(it.startAt) : null,
    endAt: it.endAt ? new Date(it.endAt) : null,
    location: it.location,
    reference: it.reference,
  }));
  const items = itemsToInsert.length
    ? await db.insert(tripItemsTable).values(itemsToInsert).returning()
    : [];

  res.status(201).json({ ...trip, items });
});

router.delete("/trips/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid trip id" });
    return;
  }
  const result = await db
    .delete(tripsTable)
    .where(and(eq(tripsTable.id, id), eq(tripsTable.userId, req.auth!.userId)))
    .returning({ id: tripsTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  res.status(204).send();
});

router.post("/trips/:id/items", requireAuth, async (req, res): Promise<void> => {
  const tripId = parseId(req.params.id);
  if (isNaN(tripId)) {
    res.status(400).json({ error: "Invalid trip id" });
    return;
  }

  // Ownership check.
  const [trip] = await db
    .select({ id: tripsTable.id })
    .from(tripsTable)
    .where(and(eq(tripsTable.id, tripId), eq(tripsTable.userId, req.auth!.userId)))
    .limit(1);
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const { type, title, startAt, endAt, location, reference } = req.body as {
    type?: string;
    title?: string;
    startAt?: string;
    endAt?: string;
    location?: string;
    reference?: string;
  };
  if (!type || !ITEM_TYPES.has(type)) {
    res.status(400).json({ error: `type must be one of: ${[...ITEM_TYPES].join(", ")}` });
    return;
  }
  if (!title?.trim()) {
    res.status(400).json({ error: "An item title is required" });
    return;
  }
  const start = startAt ? new Date(startAt) : null;
  const end = endAt ? new Date(endAt) : null;
  if (start && isNaN(start.getTime())) {
    res.status(400).json({ error: "startAt is not a valid date/time" });
    return;
  }
  if (end && isNaN(end.getTime())) {
    res.status(400).json({ error: "endAt is not a valid date/time" });
    return;
  }

  const [item] = await db
    .insert(tripItemsTable)
    .values({
      tripId,
      userId: req.auth!.userId,
      type,
      title: title.trim(),
      startAt: start,
      endAt: end,
      location: location?.trim() || null,
      reference: reference?.trim() || null,
    })
    .returning();

  res.status(201).json(item);
});

router.delete("/trips/:id/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const itemId = parseId(req.params.itemId);
  if (isNaN(itemId)) {
    res.status(400).json({ error: "Invalid item id" });
    return;
  }
  const result = await db
    .delete(tripItemsTable)
    .where(and(eq(tripItemsTable.id, itemId), eq(tripItemsTable.userId, req.auth!.userId)))
    .returning({ id: tripItemsTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.status(204).send();
});

export default router;
