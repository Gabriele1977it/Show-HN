import { db, disruptionsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { analyzeDisruption } from "../lib/ai";

const router: IRouter = Router();

router.get("/disruptions", requireAuth, async (req, res): Promise<void> => {
  const disruptions = await db
    .select()
    .from(disruptionsTable)
    .where(eq(disruptionsTable.userId, req.auth!.userId))
    .orderBy(desc(disruptionsTable.createdAt));

  res.json(disruptions);
});

router.post("/disruptions", requireAuth, async (req, res): Promise<void> => {
  const {
    airline,
    flightNumber,
    origin,
    destination,
    scheduledAt,
    disruptionType,
    details,
  } = req.body as {
    airline?: string;
    flightNumber?: string;
    origin?: string;
    destination?: string;
    scheduledAt?: string;
    disruptionType?: string;
    details?: string;
  };

  if (!airline?.trim() || !flightNumber?.trim() || !origin?.trim() || !destination?.trim() || !scheduledAt?.trim() || !disruptionType) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const validTypes = ["delay", "cancellation", "missed_connection", "denied_boarding"];
  if (!validTypes.includes(disruptionType)) {
    res.status(400).json({ error: "Invalid disruption type" });
    return;
  }

  // analyzeDisruption always returns full, honest guidance — rights/actions/
  // checklist are computed deterministically, and the AI only warms the tone
  // (skipped on any failure). So a single insert always carries complete
  // guidance, even on poor airport wifi.
  const analysis = await analyzeDisruption({
    airline: airline.trim(),
    flightNumber: flightNumber.trim(),
    origin: origin.trim(),
    destination: destination.trim(),
    scheduledAt: scheduledAt.trim(),
    disruptionType,
    details: details?.trim() || "No additional details provided.",
  });

  const [disruption] = await db
    .insert(disruptionsTable)
    .values({
      userId: req.auth!.userId,
      airline: airline.trim(),
      flightNumber: flightNumber.trim().toUpperCase(),
      origin: origin.trim().toUpperCase(),
      destination: destination.trim().toUpperCase(),
      scheduledAt: scheduledAt.trim(),
      disruptionType,
      details: details?.trim() ?? "",
      rights: analysis.rights,
      actions: analysis.actions,
      checklist: analysis.checklist,
      companionMessage: analysis.companionMessage,
      proactiveHint: analysis.proactiveHint,
      proactiveAction: analysis.proactiveAction,
    })
    .returning();

  req.log.info({ disruptionId: disruption.id }, "Disruption created with deterministic guidance");
  res.status(201).json(disruption);
});

router.get("/disruptions/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid disruption id" });
    return;
  }

  const [disruption] = await db
    .select()
    .from(disruptionsTable)
    .where(
      and(
        eq(disruptionsTable.id, id),
        eq(disruptionsTable.userId, req.auth!.userId),
      ),
    )
    .limit(1);

  if (!disruption) {
    res.status(404).json({ error: "Disruption not found" });
    return;
  }

  res.json(disruption);
});

router.delete("/disruptions/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid disruption id" });
    return;
  }

  const result = await db
    .delete(disruptionsTable)
    .where(
      and(
        eq(disruptionsTable.id, id),
        eq(disruptionsTable.userId, req.auth!.userId),
      ),
    )
    .returning({ id: disruptionsTable.id });

  if (result.length === 0) {
    res.status(404).json({ error: "Disruption not found" });
    return;
  }

  res.status(204).send();
});

router.patch("/disruptions/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid disruption id" });
    return;
  }

  const { checklist } = req.body as { checklist?: unknown };

  const [disruption] = await db
    .update(disruptionsTable)
    .set({ ...(checklist !== undefined ? { checklist } : {}) })
    .where(
      and(
        eq(disruptionsTable.id, id),
        eq(disruptionsTable.userId, req.auth!.userId),
      ),
    )
    .returning();

  if (!disruption) {
    res.status(404).json({ error: "Disruption not found" });
    return;
  }

  res.json(disruption);
});

export default router;
