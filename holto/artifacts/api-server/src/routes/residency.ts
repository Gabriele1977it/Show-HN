import { countryStaysTable, db } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { computeResidency, type Stay } from "../lib/residency";

const router: IRouter = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseId(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(v ?? "", 10);
}

// List the user's stays, newest arrival first.
router.get("/residency/stays", requireAuth, async (req, res): Promise<void> => {
  const stays = await db
    .select()
    .from(countryStaysTable)
    .where(eq(countryStaysTable.userId, req.auth!.userId))
    .orderBy(desc(countryStaysTable.arrivalDate));
  res.json(stays);
});

// Days-in-country summary with threshold warnings.
router.get("/residency/summary", requireAuth, async (req, res): Promise<void> => {
  const stays = await db
    .select()
    .from(countryStaysTable)
    .where(eq(countryStaysTable.userId, req.auth!.userId));

  const today = new Date().toISOString().slice(0, 10);
  const countries = computeResidency(stays as Stay[], today);
  res.json({ today, threshold: 183, countries });
});

router.post("/residency/stays", requireAuth, async (req, res): Promise<void> => {
  const { countryCode, countryName, arrivalDate, departureDate, note } = req.body as {
    countryCode?: string;
    countryName?: string;
    arrivalDate?: string;
    departureDate?: string | null;
    note?: string;
  };

  if (!countryCode?.trim() || !countryName?.trim() || !arrivalDate || !ISO_DATE.test(arrivalDate)) {
    res.status(400).json({ error: "countryCode, countryName and a valid arrivalDate (YYYY-MM-DD) are required" });
    return;
  }
  if (departureDate && !ISO_DATE.test(departureDate)) {
    res.status(400).json({ error: "departureDate must be YYYY-MM-DD" });
    return;
  }
  if (departureDate && departureDate < arrivalDate) {
    res.status(400).json({ error: "departureDate cannot be before arrivalDate" });
    return;
  }

  const [stay] = await db
    .insert(countryStaysTable)
    .values({
      userId: req.auth!.userId,
      countryCode: countryCode.trim().toUpperCase().slice(0, 2),
      countryName: countryName.trim(),
      arrivalDate,
      departureDate: departureDate || null,
      note: note?.trim() || null,
    })
    .returning();

  res.status(201).json(stay);
});

router.patch("/residency/stays/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid stay id" });
    return;
  }

  const { arrivalDate, departureDate, note } = req.body as {
    arrivalDate?: string;
    departureDate?: string | null;
    note?: string;
  };
  if (arrivalDate && !ISO_DATE.test(arrivalDate)) {
    res.status(400).json({ error: "arrivalDate must be YYYY-MM-DD" });
    return;
  }
  if (departureDate && !ISO_DATE.test(departureDate)) {
    res.status(400).json({ error: "departureDate must be YYYY-MM-DD" });
    return;
  }

  const [stay] = await db
    .update(countryStaysTable)
    .set({
      ...(arrivalDate ? { arrivalDate } : {}),
      ...(departureDate !== undefined ? { departureDate: departureDate || null } : {}),
      ...(note !== undefined ? { note: note?.trim() || null } : {}),
    })
    .where(and(eq(countryStaysTable.id, id), eq(countryStaysTable.userId, req.auth!.userId)))
    .returning();

  if (!stay) {
    res.status(404).json({ error: "Stay not found" });
    return;
  }
  res.json(stay);
});

router.delete("/residency/stays/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid stay id" });
    return;
  }

  const result = await db
    .delete(countryStaysTable)
    .where(and(eq(countryStaysTable.id, id), eq(countryStaysTable.userId, req.auth!.userId)))
    .returning({ id: countryStaysTable.id });

  if (result.length === 0) {
    res.status(404).json({ error: "Stay not found" });
    return;
  }
  res.status(204).send();
});

export default router;
