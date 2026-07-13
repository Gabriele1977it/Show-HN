import { db, expensesTable, tripItemsTable, tripsTable } from "@workspace/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { parseTripFromText, parseTripFromDocument, type ParsedTrip } from "../lib/trip-parse";
import { llmConfigured } from "../lib/llm";
import { getRatesPerGBP, toGBP } from "../lib/fx";
import { makeSlug } from "../lib/slug";
import { rateLimit } from "../lib/rate-limit";
import { allowAiCall } from "../lib/usage";

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

  // Per-trip expense totals in GBP (live FX), so the timeline shows spend.
  const expenseTotals = new Map<number, number>();
  if (tripIds.length) {
    const rows = await db
      .select({ tripId: expensesTable.tripId, amount: expensesTable.amount, currency: expensesTable.currency })
      .from(expensesTable)
      .where(and(eq(expensesTable.userId, req.auth!.userId), inArray(expensesTable.tripId, tripIds)));
    if (rows.length) {
      const rates = await getRatesPerGBP();
      for (const r of rows) {
        if (r.tripId == null) continue;
        const gbp = toGBP(parseFloat(r.amount), r.currency, rates);
        if (gbp == null) continue;
        expenseTotals.set(r.tripId, (expenseTotals.get(r.tripId) ?? 0) + gbp);
      }
    }
  }

  res.json(
    trips.map((t) => ({
      ...t,
      items: byTrip.get(t.id) ?? [],
      expenseTotalGBP: Math.round((expenseTotals.get(t.id) ?? 0) * 100) / 100,
    })),
  );
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

// Persist a parsed booking as a trip + timeline items. Shared by the paste and
// file-upload parsers so there's one insertion path.
async function persistParsedTrip(userId: number, parsed: ParsedTrip) {
  const [trip] = await db
    .insert(tripsTable)
    .values({
      userId,
      title: parsed.title,
      destination: parsed.destination,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
    })
    .returning();

  const itemsToInsert = parsed.items.map((it) => ({
    tripId: trip.id,
    userId,
    type: it.type,
    title: it.title,
    startAt: it.startAt ? new Date(it.startAt) : null,
    endAt: it.endAt ? new Date(it.endAt) : null,
    location: it.location,
    reference: it.reference,
  }));
  const items = itemsToInsert.length ? await db.insert(tripItemsTable).values(itemsToInsert).returning() : [];
  return { ...trip, items };
}

// Paste a booking confirmation → parse it into a trip with items (uses the
// existing LLM key; no third-party email service needed).
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

  res.status(201).json(await persistParsedTrip(req.auth!.userId, parsed));
});

// Upload a booking document (PDF, or a photo/screenshot) → the model reads it
// directly and builds the trip. Free-tier: Gemini multimodal, no PDF library.
const ALLOWED_DOC_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic"]);
const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB decoded

router.post("/trips/parse-file", requireAuth, async (req, res): Promise<void> => {
  if (!rateLimit(`docparse:${req.auth!.userId}`, 30, 60 * 60 * 1000)) {
    res.status(429).json({ error: "You've imported a lot of documents just now. Please wait a little and try again." });
    return;
  }
  let { data } = req.body as { data?: string };
  const { mimeType } = req.body as { mimeType?: string };

  if (typeof data !== "string" || !data || typeof mimeType !== "string") {
    res.status(400).json({ error: "Upload a booking file (PDF or image)." });
    return;
  }
  // Accept a full data: URL or a bare base64 string.
  const comma = data.indexOf(",");
  if (data.startsWith("data:") && comma !== -1) data = data.slice(comma + 1);

  if (!ALLOWED_DOC_MIME.has(mimeType)) {
    res.status(415).json({ error: "That file type isn't supported. Upload a PDF, or a JPG/PNG photo of your booking." });
    return;
  }
  // base64 → byte-length guard (4 chars ≈ 3 bytes).
  if (Math.floor((data.length * 3) / 4) > MAX_DOC_BYTES) {
    res.status(413).json({ error: "That file is a bit large. Please upload a booking under 10 MB." });
    return;
  }

  // Reading documents needs an AI key — say so plainly rather than a vague "couldn't read".
  if (!llmConfigured()) {
    res.status(503).json({ error: "Document reading isn't switched on yet (it needs an AI key). You can paste the booking text instead." });
    return;
  }

  const gate = await allowAiCall(req.auth!.userId);
  if (!gate.allowed) {
    res.status(429).json({ error: "You've reached today's AI limit. It resets tomorrow — upgrade for unlimited scans.", requiresUpgrade: true });
    return;
  }

  const { trip, diag } = await parseTripFromDocument({ data, mimeType });
  if (!trip) {
    req.log.warn({ diag, mimeType }, "Booking document parse failed");
    res.status(422).json({
      error: `Couldn't read a booking from that file. Reason: ${diag}. Try a clearer copy, or paste the text instead.`,
    });
    return;
  }

  res.status(201).json(await persistParsedTrip(req.auth!.userId, trip));
});

// Publish / unpublish a trip as a shareable public recap, and toggle whether the
// spend total is shown. The slug is minted once and kept stable so re-sharing
// gives the same link.
router.post("/trips/:id/share", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid trip id" });
    return;
  }
  const { isPublic, showSpend } = req.body as { isPublic?: boolean; showSpend?: boolean };

  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(and(eq(tripsTable.id, id), eq(tripsTable.userId, req.auth!.userId)))
    .limit(1);
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const [updated] = await db
    .update(tripsTable)
    .set({
      isPublic: isPublic !== false,
      publicSlug: trip.publicSlug ?? makeSlug(),
      publicShowSpend: showSpend == null ? trip.publicShowSpend : !!showSpend,
    })
    .where(and(eq(tripsTable.id, id), eq(tripsTable.userId, req.auth!.userId)))
    .returning();

  res.json({ isPublic: updated.isPublic, slug: updated.publicSlug, showSpend: updated.publicShowSpend });
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
