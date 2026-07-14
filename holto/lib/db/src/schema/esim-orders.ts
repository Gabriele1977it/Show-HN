import { integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { usersTable } from "./users";

// A traveller's eSIM purchase. Created "pending" when checkout starts, moved to
// "fulfilled" once Stripe confirms payment and the Airalo order returns the eSIM
// (ICCID + QR). Never store card data — that lives with Stripe.
export const esimOrdersTable = pgTable("esim_orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  country: text("country").notNull(), // ISO-3166 alpha-2
  packageId: text("package_id").notNull(),
  packageTitle: text("package_title").notNull(),
  dataLabel: text("data_label"), // "1 GB"
  days: integer("days"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // charged
  currency: text("currency").notNull(),
  status: text("status").notNull().default("pending"), // pending | fulfilled | failed
  stripeSessionId: text("stripe_session_id"),
  airaloOrderId: text("airalo_order_id"),
  iccid: text("iccid"),
  qrCodeUrl: text("qr_code_url"),
  lpa: text("lpa"), // LPA activation string (encodes SM-DP+ + matching id)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EsimOrder = typeof esimOrdersTable.$inferSelect;
