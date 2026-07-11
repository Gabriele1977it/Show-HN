import { date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

// A period a traveller spent (or is spending) in a country. Used by the
// residency / days-in-country tracker to warn before a tax-residency or
// visa-overstay threshold (e.g. the 183-day rule) is crossed. An open stay
// (null departure) means "still there" and is counted up to today.
export const countryStaysTable = pgTable("country_stays", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  countryCode: text("country_code").notNull(), // ISO-3166 alpha-2, e.g. "PT"
  countryName: text("country_name").notNull(),
  arrivalDate: date("arrival_date").notNull(), // "YYYY-MM-DD"
  departureDate: date("departure_date"), // null = still in country
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCountryStaySchema = createInsertSchema(countryStaysTable).omit({
  id: true,
  createdAt: true,
});

export type InsertCountryStay = z.infer<typeof insertCountryStaySchema>;
export type CountryStay = typeof countryStaysTable.$inferSelect;
