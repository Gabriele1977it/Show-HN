import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

export const disruptionsTable = pgTable("disruptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  airline: text("airline").notNull(),
  flightNumber: text("flight_number").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  scheduledAt: text("scheduled_at").notNull(),
  disruptionType: text("disruption_type").notNull(),
  details: text("details").notNull().default(""),
  rights: text("rights"),
  actions: jsonb("actions"),
  checklist: jsonb("checklist"),
  companionMessage: text("companion_message"),
  proactiveHint: text("proactive_hint"),
  proactiveAction: jsonb("proactive_action"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDisruptionSchema = createInsertSchema(disruptionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDisruption = z.infer<typeof insertDisruptionSchema>;
export type Disruption = typeof disruptionsTable.$inferSelect;
