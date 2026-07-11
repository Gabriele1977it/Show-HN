import { db, expensesTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { getRatesPerGBP } from "../lib/fx";
import { summarizeExpenses } from "../lib/expense-summary";

const router: IRouter = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES = new Set(["flights", "lodging", "meals", "transport", "entertainment", "supplies", "other"]);

function parseId(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(v ?? "", 10);
}

// List expenses (newest first) plus a live-FX GBP summary.
router.get("/expenses", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.userId, req.auth!.userId))
    .orderBy(desc(expensesTable.spentOn));

  const rates = await getRatesPerGBP();
  const summary = summarizeExpenses(rows, rates);
  res.json({ expenses: rows, summary });
});

router.post("/expenses", requireAuth, async (req, res): Promise<void> => {
  const { category, merchant, amount, currency, spentOn, note, tripId } = req.body as {
    category?: string;
    merchant?: string;
    amount?: number | string;
    currency?: string;
    spentOn?: string;
    note?: string;
    tripId?: number | null;
  };

  if (!category || !CATEGORIES.has(category)) {
    res.status(400).json({ error: `category must be one of: ${[...CATEGORIES].join(", ")}` });
    return;
  }
  const amt = typeof amount === "number" ? amount : parseFloat(amount ?? "");
  if (!Number.isFinite(amt) || amt <= 0) {
    res.status(400).json({ error: "A positive amount is required" });
    return;
  }
  if (!currency || !/^[A-Za-z]{3}$/.test(currency)) {
    res.status(400).json({ error: "A 3-letter currency code is required" });
    return;
  }
  if (!spentOn || !ISO_DATE.test(spentOn)) {
    res.status(400).json({ error: "spentOn must be YYYY-MM-DD" });
    return;
  }

  const [expense] = await db
    .insert(expensesTable)
    .values({
      userId: req.auth!.userId,
      tripId: typeof tripId === "number" ? tripId : null,
      category,
      merchant: merchant?.trim() || null,
      amount: amt.toFixed(2),
      currency: currency.toUpperCase(),
      spentOn,
      note: note?.trim() || null,
    })
    .returning();

  res.status(201).json(expense);
});

router.delete("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid expense id" });
    return;
  }
  const result = await db
    .delete(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.userId, req.auth!.userId)))
    .returning({ id: expensesTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.status(204).send();
});

export default router;
