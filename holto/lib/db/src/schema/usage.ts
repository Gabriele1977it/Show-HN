import { date, integer, pgTable, serial, timestamp, unique } from "drizzle-orm/pg-core";

import { usersTable } from "./users";

// Per-user, per-day usage counters for free-tier limits (e.g. flight searches).
export const dailyUsageTable = pgTable(
  "daily_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    day: date("day").notNull(), // "YYYY-MM-DD"
    flightSearches: integer("flight_searches").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("daily_usage_user_day").on(t.userId, t.day)],
);

export type DailyUsage = typeof dailyUsageTable.$inferSelect;
