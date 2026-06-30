// EchoDeck server entry point.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv } from "./env.js";

// Load .env from the project root before reading any configuration.
loadEnv(join(dirname(fileURLToPath(import.meta.url)), "..", ".env"));

import { createStore } from "./store.js";
import { createApp } from "./app.js";
import { createReminderService, webhookNotifier, consoleNotifier } from "./reminders.js";
import { createBilling } from "./billing.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.ECHODECK_DATA || join(ROOT, "data", "db.json");
const UPLOADS_DIR = process.env.ECHODECK_UPLOADS || join(ROOT, "uploads");

const store = createStore(DATA_FILE);

// Reminders: deliver via REMINDER_WEBHOOK_URL when set (ntfy / Slack / email
// relay), otherwise log to the console so the surface is always inspectable.
const reminders = createReminderService({
  store,
  notify: process.env.REMINDER_WEBHOOK_URL
    ? webhookNotifier(process.env.REMINDER_WEBHOOK_URL)
    : consoleNotifier(),
  config: {
    minDue: Number(process.env.REMINDER_MIN_DUE) || 1,
    minIntervalMs: Number(process.env.REMINDER_MIN_INTERVAL_MS) || undefined,
    pollMs: Number(process.env.REMINDER_POLL_MS) || undefined,
  },
});

// Billing: real Stripe checkout when STRIPE_SECRET_KEY is set, otherwise dev
// mode (the upgrade applies immediately so the flow works without live keys).
const billing = createBilling({
  store,
  config: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    pricePro: process.env.STRIPE_PRICE_PRO,
    priceTeam: process.env.STRIPE_PRICE_TEAM,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
});

// Owner allowlist (comma-separated emails) — these accounts get the Team plan
// for free. Set OWNER_EMAILS in your .env.
const ownerEmails = new Set(
  (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

const app = createApp({ store, uploadsDir: UPLOADS_DIR, reminders, billing, ownerEmails });

const server = app.listen(PORT, () => {
  console.log(`EchoDeck running on http://localhost:${PORT}`);
  console.log(billing.enabled ? "Stripe billing enabled." : "Billing in dev mode (no Stripe keys).");
  // Background polling only runs when explicitly enabled.
  if (process.env.REMINDER_ENABLED === "1" || process.env.REMINDER_ENABLED === "true") {
    reminders.start();
    console.log("Reminder polling enabled.");
  }
});

// Graceful shutdown so hosts can restart/deploy cleanly.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`${sig} received, shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
