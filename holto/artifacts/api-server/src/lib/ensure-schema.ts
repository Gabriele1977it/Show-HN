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
