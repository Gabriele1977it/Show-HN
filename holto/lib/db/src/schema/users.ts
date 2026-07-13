import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  starterPackEmail: text("starter_pack_email"),
  stripeCustomerId: text("stripe_customer_id"),
  tripPassExpiresAt: timestamp("trip_pass_expires_at", { withTimezone: true }),
  // Manually-granted tier ("trip_pass" | "pro"), set by an owner from the admin
  // panel — used to comp influencers without going through Stripe. Null = none.
  grantedTier: text("granted_tier"),
  // Growth: each user's own share code, and who invited them (if anyone).
  referralCode: text("referral_code").unique(),
  referredBy: integer("referred_by"),
  // Password reset: we store only a SHA-256 hash of the emailed token, plus its
  // expiry. The raw token lives only in the reset link. Both cleared on use.
  resetTokenHash: text("reset_token_hash"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),
  // AwardWallet Account Access link: the connected user's AwardWallet id, so we
  // can pull the loyalty balances they've shared. Null = not connected.
  awardwalletUserId: integer("awardwallet_user_id"),
  awardwalletSyncedAt: timestamp("awardwallet_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
