import { db, expensesTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { getRatesPerGBP, toGBP } from "../lib/fx";
import { summarizeExpenses } from "../lib/expense-summary";
import { parseReceiptFromDocument } from "../lib/receipt-parse";
import { llmConfigured } from "../lib/llm";
import { rateLimit } from "../lib/rate-limit";
import { allowAiCall } from "../lib/usage";

const router: IRouter = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES = new Set(["flights", "lodging", "meals", "transport", "entertainment", "supplies", "other"]);
const ALLOWED_DOC_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic"]);
const MAX_DOC_BYTES = 10 * 1024 * 1024;

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
  // Attach a per-row GBP figure so the client can build a complete reimbursement
  // report without a second round-trip (zero extra AI cost — pure FX).
  const expenses = rows.map((e) => {
    const gbp = toGBP(parseFloat(e.amount), e.currency, rates);
    return { ...e, amountGBP: gbp == null ? null : Math.round(gbp * 100) / 100 };
  });
  res.json({ expenses, summary });
});

router.post("/expenses", requireAuth, async (req, res): Promise<void> => {
  const { category, merchant, amount, currency, spentOn, note, tripId, reimbursable } = req.body as {
    category?: string;
    merchant?: string;
    amount?: number | string;
    currency?: string;
    spentOn?: string;
    note?: string;
    tripId?: number | null;
    reimbursable?: boolean;
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
      reimbursable: reimbursable !== false,
      note: note?.trim() || null,
    })
    .returning();

  res.status(201).json(expense);
});

// Scan a receipt (photo or PDF) → extracted expense fields for the user to
// review before saving. Never auto-saves. Token-frugal (small output budget).
router.post("/expenses/scan", requireAuth, async (req, res): Promise<void> => {
  if (!rateLimit(`receiptscan:${req.auth!.userId}`, 40, 60 * 60 * 1000)) {
    res.status(429).json({ error: "You've scanned a lot of receipts just now. Please wait a little and try again." });
    return;
  }
  let { data } = req.body as { data?: string };
  const { mimeType } = req.body as { mimeType?: string };
  if (typeof data !== "string" || !data || typeof mimeType !== "string") {
    res.status(400).json({ error: "Upload a receipt (photo or PDF)." });
    return;
  }
  const comma = data.indexOf(",");
  if (data.startsWith("data:") && comma !== -1) data = data.slice(comma + 1);
  if (!ALLOWED_DOC_MIME.has(mimeType)) {
    res.status(415).json({ error: "Upload a PDF, or a JPG/PNG photo of the receipt." });
    return;
  }
  if (Math.floor((data.length * 3) / 4) > MAX_DOC_BYTES) {
    res.status(413).json({ error: "That file is a bit large. Please keep it under 10 MB." });
    return;
  }
  if (!llmConfigured()) {
    res.status(503).json({ error: "Receipt scanning isn't switched on yet (it needs an AI key). Enter the expense manually instead." });
    return;
  }

  const gate = await allowAiCall(req.auth!.userId);
  if (!gate.allowed) {
    res.status(429).json({ error: "You've reached today's AI limit. It resets tomorrow — upgrade for unlimited scans.", requiresUpgrade: true });
    return;
  }

  const { receipt, diag } = await parseReceiptFromDocument({ data, mimeType });
  if (!receipt) {
    req.log.warn({ diag, mimeType }, "Receipt scan failed");
    res.status(422).json({ error: `Couldn't read that receipt. Reason: ${diag}. Enter it manually instead.` });
    return;
  }
  res.json(receipt);
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
