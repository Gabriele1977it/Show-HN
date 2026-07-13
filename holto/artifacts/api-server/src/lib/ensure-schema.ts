import { pool } from "@workspace/db";

import { logger } from "./logger";

// Lightweight, idempotent schema reconcile for columns this app has added over
// time. The Stripe schema has its own runMigrations(); the app's own tables are
// otherwise only updated by a manual `drizzle-kit push`, which is easy to forget
// on a hosted deploy. Every statement here is `IF NOT EXISTS`, so running it on
// each boot is a no-op once the column exists — it just guarantees a freshly
// deployed API can't be ahead of its database. Never throws fatally: a failure
// is logged and the server continues (the affected feature will surface its own
// error rather than crashing the process).
const STATEMENTS: string[] = [
  // Growth + comp-tier columns (admin-granted tiers, referrals).
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "granted_tier" text`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" text`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by" integer`,
  // Password reset (forgot-password flow).
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_hash" text`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_expires_at" timestamp with time zone`,
  // AwardWallet Account Access link.
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "awardwallet_user_id" integer`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "awardwallet_synced_at" timestamp with time zone`,
  // Loyalty row provenance ("manual" vs "awardwallet").
  `ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "source" text`,
  // AI-usage counter for the owner cost dashboard.
  `ALTER TABLE "daily_usage" ADD COLUMN IF NOT EXISTS "ai_calls" integer NOT NULL DEFAULT 0`,
  // Saved-destinations watchlist.
  `CREATE TABLE IF NOT EXISTS "saved_destinations" (
    "id" serial PRIMARY KEY,
    "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "saved_destinations_user_code" UNIQUE ("user_id", "code")
  )`,
  // Aggregated, privacy-friendly analytics.
  `CREATE TABLE IF NOT EXISTS "analytics_daily" (
    "id" serial PRIMARY KEY,
    "day" date NOT NULL,
    "event" text NOT NULL,
    "count" integer NOT NULL DEFAULT 0,
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "analytics_daily_day_event" UNIQUE ("day", "event")
  )`,
];

export async function ensureAppSchema(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    logger.warn("DATABASE_URL not set — skipping app schema reconcile");
    return;
  }
  for (const sql of STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (err) {
      logger.error({ err, sql }, "App schema reconcile statement failed");
    }
  }
  logger.info("App schema reconcile complete");
}
