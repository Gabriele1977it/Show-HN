import { date, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

// Privacy-friendly, aggregated analytics: a per-day count for each named event.
// No user id, no PII, no device fingerprint — just "how many times did X happen
// today". Cheap to write (one upsert per event/day) and impossible to use for
// tracking individuals. Event names are whitelisted server-side to keep the
// cardinality bounded.
export const analyticsDailyTable = pgTable(
  "analytics_daily",
  {
    id: serial("id").primaryKey(),
    day: date("day").notNull(), // "YYYY-MM-DD"
    event: text("event").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("analytics_daily_day_event").on(t.day, t.event)],
);

export type AnalyticsDaily = typeof analyticsDailyTable.$inferSelect;
