import { date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

// A traveller's loyalty & rewards memberships — airline, hotel, rail, car and
// card programs — kept in one wallet so membership numbers are to hand at
// check-in and points/status expiry never sneaks up. Balances and expiry are
// entered manually (no third-party program API needed), so this stays fully
// free-tier and works for any programme in the world.
export const loyaltyProgramsTable = pgTable("loyalty_programs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // airline | hotel | rail | car | card | other
  programName: text("program_name").notNull(), // "British Airways Executive Club"
  membershipNumber: text("membership_number"),
  tier: text("tier"), // "Gold", "Silver", "Diamond"…
  pointsBalance: integer("points_balance"), // nullable — many users won't track this
  expiresAt: date("expires_at"), // points/status expiry, "YYYY-MM-DD", nullable
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLoyaltyProgramSchema = createInsertSchema(loyaltyProgramsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLoyaltyProgram = z.infer<typeof insertLoyaltyProgramSchema>;
export type LoyaltyProgram = typeof loyaltyProgramsTable.$inferSelect;
