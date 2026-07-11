import { date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

// A trip groups a traveller's itinerary — flights, hotels, trains, meetings —
// into one timeline. Items are added manually today; a forwarded-email parser
// will populate them automatically once inbound email is wired up.
export const tripsTable = pgTable("trips", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  destination: text("destination"), // optional "Lisbon, Portugal"
  startDate: date("start_date"), // "YYYY-MM-DD", nullable
  endDate: date("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripSchema = createInsertSchema(tripsTable).omit({ id: true, createdAt: true });
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof tripsTable.$inferSelect;

// A single item on a trip timeline.
export const tripItemsTable = pgTable("trip_items", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id")
    .notNull()
    .references(() => tripsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // flight | hotel | train | car | activity | other
  title: text("title").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }), // when it begins
  endAt: timestamp("end_at", { withTimezone: true }),
  location: text("location"),
  reference: text("reference"), // booking / confirmation number
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripItemSchema = createInsertSchema(tripItemsTable).omit({ id: true, createdAt: true });
export type InsertTripItem = z.infer<typeof insertTripItemSchema>;
export type TripItem = typeof tripItemsTable.$inferSelect;
