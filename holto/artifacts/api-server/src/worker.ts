import { syncAllPackages } from "./lib/airalo";
import { logger } from "./lib/logger";
import { pollOnce } from "./lib/monitor";
import { initSentry } from "./lib/sentry";

// Standalone long-running process that powers HOLTO's proactive monitoring.
// It shares the API server's code (flight lookup, db, alert delivery) but runs
// as its own process so alerts fire even when no client is connected.

initSentry("worker");

const POLL_MS = Number(process.env.MONITOR_POLL_MS) || 15 * 60 * 1000;
// Airalo asks partners to sync GET /v2/packages at least hourly so we never
// show retired or out-of-stock plans. No-op until Airalo creds are set.
const PACKAGE_SYNC_MS = Number(process.env.AIRALO_SYNC_MS) || 60 * 60 * 1000;

let running = false;
let stopping = false;

async function tick(): Promise<void> {
  if (running) {
    logger.warn("Previous monitor pass still running — skipping this tick");
    return;
  }
  running = true;
  try {
    await pollOnce();
  } catch (err) {
    logger.error({ err }, "Monitor pass threw");
  } finally {
    running = false;
  }
}

async function syncPackages(): Promise<void> {
  try {
    await syncAllPackages();
  } catch (err) {
    logger.error({ err }, "Airalo package sync threw");
  }
}

async function main(): Promise<void> {
  logger.info({ pollMs: POLL_MS, packageSyncMs: PACKAGE_SYNC_MS }, "HOLTO monitor worker starting");
  await tick(); // run once immediately on boot
  void syncPackages(); // keep the Airalo catalogue fresh from boot
  const timer = setInterval(() => {
    if (!stopping) void tick();
  }, POLL_MS);
  const packageTimer = setInterval(() => {
    if (!stopping) void syncPackages();
  }, PACKAGE_SYNC_MS);

  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, () => {
      logger.info({ sig }, "Monitor worker shutting down");
      stopping = true;
      clearInterval(timer);
      clearInterval(packageTimer);
      setTimeout(() => process.exit(0), 1000).unref();
    });
  }
}

main().catch((err) => {
  logger.error({ err }, "Monitor worker failed to start");
  process.exit(1);
});
