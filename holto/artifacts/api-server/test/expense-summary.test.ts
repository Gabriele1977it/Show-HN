import assert from "node:assert/strict";
import { test } from "node:test";

import { summarizeExpenses } from "../src/lib/expense-summary.ts";

// units per GBP
const RATES = { EUR: 1.17, USD: 1.27, EGP: 77 };

test("converts each expense to GBP and totals by category", () => {
  const s = summarizeExpenses(
    [
      { category: "lodging", amount: "117.00", currency: "EUR" }, // 100 GBP
      { category: "meals", amount: "12.70", currency: "USD" }, // 10 GBP
      { category: "meals", amount: "77.00", currency: "EGP" }, // 1 GBP
      { category: "flights", amount: "250.00", currency: "GBP" }, // 250 GBP
    ],
    RATES,
  );
  assert.equal(s.totalGBP, 361);
  assert.equal(s.byCategory.lodging, 100);
  assert.equal(s.byCategory.meals, 11);
  assert.equal(s.byCategory.flights, 250);
  assert.equal(s.unconvertedCount, 0);
  assert.equal(s.count, 4);
});

test("GBP passes through unchanged", () => {
  const s = summarizeExpenses([{ category: "other", amount: 42, currency: "GBP" }], {});
  assert.equal(s.totalGBP, 42);
});

test("unknown currency is counted, not guessed", () => {
  const s = summarizeExpenses(
    [
      { category: "meals", amount: "100", currency: "XYZ" },
      { category: "meals", amount: "117", currency: "EUR" },
    ],
    RATES,
  );
  assert.equal(s.unconvertedCount, 1);
  assert.equal(s.totalGBP, 100); // only the EUR one converted
});

test("non-numeric amounts are skipped", () => {
  const s = summarizeExpenses([{ category: "meals", amount: "abc", currency: "GBP" }], {});
  assert.equal(s.totalGBP, 0);
});

test("splits company-reimbursable from personal spend", () => {
  const s = summarizeExpenses(
    [
      { category: "lodging", amount: 100, currency: "GBP", reimbursable: true },
      { category: "meals", amount: 30, currency: "GBP", reimbursable: false },
      { category: "flights", amount: 200, currency: "GBP" }, // missing flag → reimbursable
    ],
    {},
  );
  assert.equal(s.totalGBP, 330);
  assert.equal(s.reimbursableGBP, 300);
  assert.equal(s.personalGBP, 30);
});
