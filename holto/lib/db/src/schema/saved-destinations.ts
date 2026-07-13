import { integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

import { usersTable } from "./users";

// A traveller's saved destinations "watchlist" — places they're keeping an eye
// on. Each row is a country (ISO alpha-2) so we can hang the free advisory / FX
// / cost-of-living data off it. One row per user per country.
export const savedDestinationsTable = pgTable(
  "saved_destinations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // ISO-3166 alpha-2
    name: text("name").notNull(), // display name, e.g. "Portugal"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("saved_destinations_user_code").on(t.userId, t.code)],
);

export type SavedDestination = typeof savedDestinationsTable.$inferSelect;
