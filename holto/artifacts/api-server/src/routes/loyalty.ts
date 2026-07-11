import { db, loyaltyProgramsTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES = new Set(["airline", "hotel", "rail", "car", "card", "other"]);

function parseId(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(v ?? "", 10);
}

// Validate + normalise an incoming program body. Returns either the cleaned
// values or an error string.
function validate(body: Record<string, unknown>): { error: string } | { values: {
  category: string;
  programName: string;
  membershipNumber: string | null;
  tier: string | null;
  pointsBalance: number | null;
  expiresAt: string | null;
  notes: string | null;
} } {
  const category = String(body.category ?? "").trim().toLowerCase();
  if (!CATEGORIES.has(category)) return { error: `category must be one of: ${[...CATEGORIES].join(", ")}` };

  const programName = String(body.programName ?? "").trim();
  if (!programName) return { error: "A programme name is required (e.g. British Airways Executive Club)." };

  const expiresAt = body.expiresAt ? String(body.expiresAt).trim() : "";
  if (expiresAt && !ISO_DATE.test(expiresAt)) return { error: "expiresAt must be YYYY-MM-DD." };

  let pointsBalance: number | null = null;
  if (body.pointsBalance != null && String(body.pointsBalance).trim() !== "") {
    const n = Number(body.pointsBalance);
    if (!Number.isFinite(n) || n < 0) return { error: "pointsBalance must be a positive number." };
    pointsBalance = Math.round(n);
  }

  return {
    values: {
      category,
      programName,
      membershipNumber: body.membershipNumber ? String(body.membershipNumber).trim() : null,
      tier: body.tier ? String(body.tier).trim() : null,
      pointsBalance,
      expiresAt: expiresAt || null,
      notes: body.notes ? String(body.notes).trim() : null,
    },
  };
}

router.get("/loyalty", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(loyaltyProgramsTable)
    .where(eq(loyaltyProgramsTable.userId, req.auth!.userId))
    .orderBy(asc(loyaltyProgramsTable.category), asc(loyaltyProgramsTable.programName));
  res.json(rows);
});

router.post("/loyalty", requireAuth, async (req, res): Promise<void> => {
  const parsed = validate(req.body as Record<string, unknown>);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [row] = await db
    .insert(loyaltyProgramsTable)
    .values({ userId: req.auth!.userId, ...parsed.values })
    .returning();
  res.status(201).json(row);
});

router.patch("/loyalty/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  const parsed = validate(req.body as Record<string, unknown>);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [row] = await db
    .update(loyaltyProgramsTable)
    .set(parsed.values)
    .where(and(eq(loyaltyProgramsTable.id, id), eq(loyaltyProgramsTable.userId, req.auth!.userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Programme not found." });
    return;
  }
  res.json(row);
});

router.delete("/loyalty/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  const result = await db
    .delete(loyaltyProgramsTable)
    .where(and(eq(loyaltyProgramsTable.id, id), eq(loyaltyProgramsTable.userId, req.auth!.userId)))
    .returning({ id: loyaltyProgramsTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Programme not found." });
    return;
  }
  res.status(204).send();
});

export default router;
