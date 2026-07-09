import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

export const monitoredFlightsTable = pgTable("monitored_flights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  flightNumber: text("flight_number").notNull(),
  destination: text("destination").notNull(),
  lastStatus: text("last_status"),
  lastStatusData: jsonb("last_status_data"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMonitoredFlightSchema = createInsertSchema(monitoredFlightsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMonitoredFlight = z.infer<typeof insertMonitoredFlightSchema>;
export type MonitoredFlight = typeof monitoredFlightsTable.$inferSelect;
