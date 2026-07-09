import { logger } from "./lib/logger";
import { pollOnce } from "./lib/monitor";

// Standalone long-running process that powers HOLTO's proactive monitoring.
// It shares the API server's code (flight lookup, db, alert delivery) but runs
// as its own process so alerts fire even when no client is connected.

const POLL_MS = Number(process.env.MONITOR_POLL_MS) || 15 * 60 * 1000;

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

async function main(): Promise<void> {
  logger.info({ pollMs: POLL_MS }, "HOLTO monitor worker starting");
  await tick(); // run once immediately on boot
  const timer = setInterval(() => {
    if (!stopping) void tick();
  }, POLL_MS);

  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, () => {
      logger.info({ sig }, "Monitor worker shutting down");
      stopping = true;
      clearInterval(timer);
      setTimeout(() => process.exit(0), 1000).unref();
    });
  }
}

main().catch((err) => {
  logger.error({ err }, "Monitor worker failed to start");
  process.exit(1);
});
