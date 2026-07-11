import { integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

import { usersTable } from "./users";

// Records proactive reminders already delivered, so the background worker never
// sends the same alert twice (e.g. one 183-day warning per country per year,
// one departure reminder per flight). refKey encodes what the reminder is for.
export const sentRemindersTable = pgTable(
  "sent_reminders",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "residency" | "flight_departure"
    refKey: text("ref_key").notNull(), // e.g. "residency:PT:approaching:2026"
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("sent_reminders_user_ref").on(t.userId, t.refKey)],
);

export type SentReminder = typeof sentRemindersTable.$inferSelect;
