import { toGBP } from "./fx";

// Pure summary of a set of expenses, converting each to GBP with the supplied
// rates (units per GBP). Amounts arrive as strings (numeric column) so we parse
// defensively. Anything in a currency the feed doesn't cover is counted in
// `unconvertedCount` and left out of the GBP totals rather than guessed.

export interface ExpenseInput {
  category: string;
  amount: string | number;
  currency: string;
}

export interface ExpenseSummary {
  totalGBP: number;
  byCategory: Record<string, number>;
  unconvertedCount: number;
  count: number;
}

export function summarizeExpenses(
  expenses: ExpenseInput[],
  rates: Record<string, number>,
): ExpenseSummary {
  let totalGBP = 0;
  let unconvertedCount = 0;
  const byCategory: Record<string, number> = {};

  for (const e of expenses) {
    const amount = typeof e.amount === "number" ? e.amount : parseFloat(e.amount);
    if (!Number.isFinite(amount)) continue;
    const gbp = toGBP(amount, e.currency, rates);
    if (gbp === null) {
      unconvertedCount += 1;
      continue;
    }
    totalGBP += gbp;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + gbp;
  }

  // Round for presentation.
  totalGBP = Math.round(totalGBP * 100) / 100;
  for (const k of Object.keys(byCategory)) {
    byCategory[k] = Math.round(byCategory[k]! * 100) / 100;
  }

  return { totalGBP, byCategory, unconvertedCount, count: expenses.length };
}
