import { date, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { tripsTable } from "./trips";
import { usersTable } from "./users";

// A single business/travel expense. Amounts are stored in their original
// currency; conversion to a GBP view happens at read time with live FX so
// historical rows aren't frozen to a stale rate. Optionally attached to a trip.
export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  tripId: integer("trip_id").references(() => tripsTable.id, { onDelete: "set null" }),
  category: text("category").notNull(), // flights | lodging | meals | transport | entertainment | supplies | other
  merchant: text("merchant"), // "British Airways", "Hilton Lisbon"
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // stored as string by drizzle
  currency: text("currency").notNull(), // ISO-4217, e.g. "EUR"
  spentOn: date("spent_on").notNull(), // "YYYY-MM-DD"
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
