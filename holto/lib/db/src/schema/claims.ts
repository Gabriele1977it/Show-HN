import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";
import { disruptionsTable } from "./disruptions";

// A compensation claim a traveller is pursuing for a disruption. HOLTO generates
// the letter and tracks the claim through to payment (or escalation), so the
// value doesn't stop at "here are your rights".
//
// status lifecycle:
//   draft → submitted → airline_responded → paid | rejected → escalated → closed
export const claimsTable = pgTable("claims", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  disruptionId: integer("disruption_id")
    .notNull()
    .references(() => disruptionsTable.id, { onDelete: "cascade" }),
  airline: text("airline").notNull(),
  flightNumber: text("flight_number").notNull(),
  // Headline compensation, in whole units of `currency`.
  amount: integer("amount"),
  currency: text("currency").notNull().default("EUR"),
  status: text("status").notNull().default("draft"),
  referenceNumber: text("reference_number"),
  letter: text("letter").notNull(),
  // Append-only audit trail: [{ status, at, note? }]
  timeline: jsonb("timeline").notNull().default([]),
  amountReceived: integer("amount_received"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClaimSchema = createInsertSchema(claimsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claimsTable.$inferSelect;
