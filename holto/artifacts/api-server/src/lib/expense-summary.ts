import { toGBP } from "./fx";

// Pure summary of a set of expenses, converting each to GBP with the supplied
// rates (units per GBP). Amounts arrive as strings (numeric column) so we parse
// defensively. Anything in a currency the feed doesn't cover is counted in
// `unconvertedCount` and left out of the GBP totals rather than guessed.

export interface ExpenseInput {
  category: string;
  amount: string | number;
  currency: string;
  reimbursable?: boolean;
}

export interface ExpenseSummary {
  totalGBP: number;
  reimbursableGBP: number; // company-claimable
  personalGBP: number;
  byCategory: Record<string, number>;
  unconvertedCount: number;
  count: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarizeExpenses(
  expenses: ExpenseInput[],
  rates: Record<string, number>,
): ExpenseSummary {
  let totalGBP = 0;
  let reimbursableGBP = 0;
  let personalGBP = 0;
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
    // Default to reimbursable when the flag is absent (older rows).
    if (e.reimbursable === false) personalGBP += gbp;
    else reimbursableGBP += gbp;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + gbp;
  }

  for (const k of Object.keys(byCategory)) byCategory[k] = round2(byCategory[k]!);

  return {
    totalGBP: round2(totalGBP),
    reimbursableGBP: round2(reimbursableGBP),
    personalGBP: round2(personalGBP),
    byCategory,
    unconvertedCount,
    count: expenses.length,
  };
}
