import { runMigrations } from "stripe-replit-sync";

import app from "./app";
import { ensureAppSchema } from "./lib/ensure-schema";
import { logger } from "./lib/logger";
import { pollOnce } from "./lib/monitor";
import { runProactiveReminders } from "./lib/reminders";
import { getStripeSync } from "./stripeClient";

// Optional in-process flight monitor. Set ENABLE_MONITOR=1 to run the poll loop
// inside the web service instead of a separate worker — saves the cost of a
// dedicated worker instance for small deployments. Never blocks the request path.
function startInProcessMonitor(): void {
  const pollMs = Number(process.env.MONITOR_POLL_MS) || 15 * 60 * 1000;
  logger.info({ pollMs }, "In-process flight monitor enabled");
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await pollOnce();
      // Proactive reminders (183-day residency, upcoming flight departures).
      await runProactiveReminders();
    } catch (err) {
      logger.error({ err }, "In-process monitor tick failed");
    } finally {
      running = false;
    }
  };
  void tick();
  setInterval(() => void tick(), pollMs).unref();
}

async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe init");
    return;
  }

  try {
    logger.info("Initialising Stripe schema…");
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");
  } catch (err) {
    logger.error({ err }, "Stripe schema migration failed — running without payments");
    return;
  }

  let stripeSync;
  try {
    stripeSync = await getStripeSync();
  } catch (err) {
    logger.error({ err }, "Failed to create StripeSync — running without payments");
    return;
  }

  // Webhook is configured manually in the Stripe dashboard pointing to
  // /api/stripe/webhook on the deployed domain. Auto-management via
  // findOrCreateManagedWebhook is deliberately disabled — it stores a
  // webhook endpoint ID in the DB that becomes stale every time Stripe
  // deletes the old endpoint, causing StripeInvalidRequestError on every
  // cold start and triggering false-positive outage alerts.
  // Public base URL of the deployed API. Prefer an explicit, host-agnostic
  // env var (works on Render/Fly/etc.); fall back to Replit's injected domain.
  const publicBase =
    process.env.PUBLIC_URL ??
    process.env.APP_ORIGIN ??
    (process.env.REPLIT_DOMAINS?.split(",")[0]
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : null);
  const webhookUrl = publicBase ? `${publicBase.replace(/\/+$/, "")}/api/stripe/webhook` : null;
  if (webhookUrl) {
    logger.info({ webhookUrl }, "Stripe webhook endpoint (configure manually in Stripe dashboard if not set)");
  }

  stripeSync
    .syncBackfill()
    .then(() => logger.info("Stripe backfill complete"))
    .catch((err) => logger.error({ err }, "Stripe backfill failed"));
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Start listening immediately so healthchecks pass from the first second.
// Stripe initialisation (migrations, webhook registration, backfill) runs in
// the background and must never block the server from binding its port.
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  if (process.env.ENABLE_MONITOR === "1" || process.env.ENABLE_MONITOR === "true") {
    startInProcessMonitor();
  }
});

// Reconcile the app's own schema (adds any missing recently-added columns),
// then bring up Stripe. Both run in the background so the port binds instantly.
ensureAppSchema()
  .catch((err) => logger.error({ err }, "App schema reconcile uncaught error"))
  .finally(() => {
    initStripe().catch((err) => logger.error({ err }, "Stripe init uncaught error"));
  });
