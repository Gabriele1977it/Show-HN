import { generateJsonFromDocument } from "./llm";

// Extract a single expense from a receipt/invoice image or PDF. Reuses the
// shared document pipeline; kept token-frugal (small output budget) since a
// receipt is tiny and this is only ever called when the user taps "Scan".

const CATEGORIES = new Set(["flights", "lodging", "meals", "transport", "entertainment", "supplies", "other"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ParsedReceipt {
  merchant: string | null;
  amount: number | null;
  currency: string | null;
  category: string;
  spentOn: string | null;
  note: string | null;
}

export interface ReceiptParseResult {
  receipt: ParsedReceipt | null;
  diag: string;
}

export async function parseReceiptFromDocument(file: { data: string; mimeType: string }): Promise<ReceiptParseResult> {
  const prompt = `This is a receipt or invoice (image or PDF). Extract the payment made — never invent values.
Respond ONLY with valid JSON, no markdown:
{
  "merchant": "shop / company name, or null",
  "amount": grand total paid (incl. tax & tip) as a number with no currency symbol, or null,
  "currency": "ISO-4217 code inferred from the symbol or country (e.g. GBP, EUR, USD), or null",
  "date": "YYYY-MM-DD or null",
  "category": "one of: flights, lodging, meals, transport, entertainment, supplies, other",
  "note": "a very short description, or null"
}`;

  const { data, diag } = await generateJsonFromDocument(prompt, file, { maxTokens: 1024, temperature: 0 });
  if (!data || typeof data !== "object") return { receipt: null, diag: diag || "couldn't read the receipt" };

  const o = data as Record<string, unknown>;
  const amountRaw = o.amount;
  const amountNum =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string"
        ? parseFloat(amountRaw.replace(/[^0-9.]/g, ""))
        : NaN;

  const receipt: ParsedReceipt = {
    merchant: typeof o.merchant === "string" && o.merchant.trim() ? o.merchant.trim().slice(0, 120) : null,
    amount: Number.isFinite(amountNum) && amountNum > 0 ? Math.round(amountNum * 100) / 100 : null,
    currency: typeof o.currency === "string" && /^[A-Za-z]{3}$/.test(o.currency.trim()) ? o.currency.trim().toUpperCase() : null,
    category: typeof o.category === "string" && CATEGORIES.has(o.category) ? o.category : "other",
    spentOn: typeof o.date === "string" && ISO_DATE.test(o.date) ? o.date : null,
    note: typeof o.note === "string" && o.note.trim() ? o.note.trim().slice(0, 200) : null,
  };

  // Useful only if we recovered at least an amount or a merchant.
  if (receipt.amount == null && receipt.merchant == null) {
    return { receipt: null, diag: diag || "couldn't find a total on the receipt" };
  }
  return { receipt, diag: "" };
}
