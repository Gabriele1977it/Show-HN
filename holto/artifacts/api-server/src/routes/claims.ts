import { claimsTable, db, disruptionsTable, usersTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import {
  buildClaimLetter,
  canTransition,
  computeClaimAmount,
  escalationGuidance,
  isClaimStatus,
  type ClaimStatus,
  type TimelineEntry,
} from "../lib/claim";

const router: IRouter = Router();

router.get("/claims", requireAuth, async (req, res): Promise<void> => {
  const claims = await db
    .select()
    .from(claimsTable)
    .where(eq(claimsTable.userId, req.auth!.userId))
    .orderBy(desc(claimsTable.createdAt));
  res.json(claims);
});

// Create a claim from an existing disruption. Idempotent per disruption: if a
// claim already exists it's returned rather than duplicated.
router.post("/claims", requireAuth, async (req, res): Promise<void> => {
  const disruptionId = Number((req.body as { disruptionId?: unknown })?.disruptionId);
  if (!Number.isInteger(disruptionId)) {
    res.status(400).json({ error: "A valid disruptionId is required." });
    return;
  }

  const [disruption] = await db
    .select()
    .from(disruptionsTable)
    .where(and(eq(disruptionsTable.id, disruptionId), eq(disruptionsTable.userId, req.auth!.userId)))
    .limit(1);

  if (!disruption) {
    res.status(404).json({ error: "Disruption not found." });
    return;
  }

  const [existing] = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.disruptionId, disruptionId), eq(claimsTable.userId, req.auth!.userId)))
    .limit(1);
  if (existing) {
    res.status(200).json(existing);
    return;
  }

  const amount = computeClaimAmount(disruption.origin, disruption.destination, disruption.disruptionType);
  const [user] = await db
    .select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, req.auth!.userId));

  const letter = buildClaimLetter({
    airline: disruption.airline,
    flightNumber: disruption.flightNumber,
    origin: disruption.origin,
    destination: disruption.destination,
    scheduledAt: disruption.scheduledAt,
    disruptionType: disruption.disruptionType,
    amount: amount?.amount ?? null,
    currency: amount?.currency ?? "EUR",
    claimantName: user?.name,
    claimantEmail: user?.email,
  });

  const timeline: TimelineEntry[] = [{ status: "draft", at: new Date().toISOString() }];

  const [claim] = await db
    .insert(claimsTable)
    .values({
      userId: req.auth!.userId,
      disruptionId,
      airline: disruption.airline,
      flightNumber: disruption.flightNumber,
      amount: amount?.amount ?? null,
      currency: amount?.currency ?? "EUR",
      status: "draft",
      letter,
      timeline,
    })
    .returning();

  req.log.info({ claimId: claim.id, disruptionId }, "Claim created");
  res.status(201).json(claim);
});

router.get("/claims/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid claim id." });
    return;
  }
  const [claim] = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.id, id), eq(claimsTable.userId, req.auth!.userId)))
    .limit(1);
  if (!claim) {
    res.status(404).json({ error: "Claim not found." });
    return;
  }
  res.json(claim);
});

// The ready-to-send letter plus factual escalation guidance, as plain text.
router.get("/claims/:id/letter", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid claim id." });
    return;
  }
  const [claim] = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.id, id), eq(claimsTable.userId, req.auth!.userId)))
    .limit(1);
  if (!claim) {
    res.status(404).json({ error: "Claim not found." });
    return;
  }
  res.type("text/plain").send(`${claim.letter}\n\n---\nIF THE AIRLINE REFUSES OR IGNORES YOU\n\n${escalationGuidance()}`);
});

// Advance the claim: change status (validated against the lifecycle), record a
// reference number, the amount received, and append to the timeline.
router.patch("/claims/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid claim id." });
    return;
  }

  const { status, referenceNumber, amountReceived, note } = req.body as {
    status?: string;
    referenceNumber?: string;
    amountReceived?: number;
    note?: string;
  };

  const [claim] = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.id, id), eq(claimsTable.userId, req.auth!.userId)))
    .limit(1);
  if (!claim) {
    res.status(404).json({ error: "Claim not found." });
    return;
  }

  const update: Record<string, unknown> = {};

  if (status !== undefined) {
    if (!isClaimStatus(status)) {
      res.status(400).json({ error: `Invalid status. One of: draft, submitted, airline_responded, paid, rejected, escalated, closed.` });
      return;
    }
    if (!canTransition(claim.status as ClaimStatus, status)) {
      res.status(400).json({ error: `Cannot move a claim from "${claim.status}" to "${status}".` });
      return;
    }
    const timeline = [
      ...((claim.timeline as TimelineEntry[] | null) ?? []),
      { status, at: new Date().toISOString(), ...(note ? { note } : {}) },
    ];
    update.status = status;
    update.timeline = timeline;
    if (status === "submitted" && !claim.submittedAt) update.submittedAt = new Date();
    if (["paid", "rejected", "closed"].includes(status)) update.resolvedAt = new Date();
  }

  if (referenceNumber !== undefined) update.referenceNumber = referenceNumber.trim();
  if (amountReceived !== undefined && Number.isFinite(amountReceived)) update.amountReceived = Math.round(amountReceived);

  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "Nothing to update." });
    return;
  }

  const [updated] = await db
    .update(claimsTable)
    .set(update)
    .where(and(eq(claimsTable.id, id), eq(claimsTable.userId, req.auth!.userId)))
    .returning();

  res.json(updated);
});

router.delete("/claims/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid claim id." });
    return;
  }
  const deleted = await db
    .delete(claimsTable)
    .where(and(eq(claimsTable.id, id), eq(claimsTable.userId, req.auth!.userId)))
    .returning({ id: claimsTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Claim not found." });
    return;
  }
  res.status(204).send();
});

export default router;
