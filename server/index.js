// EchoDeck server entry point.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createStore } from "./store.js";
import { createApp } from "./app.js";
import { createReminderService, webhookNotifier, consoleNotifier } from "./reminders.js";

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

const app = createApp({ store, uploadsDir: UPLOADS_DIR, reminders });

app.listen(PORT, () => {
  console.log(`EchoDeck running on http://localhost:${PORT}`);
  // Background polling only runs when explicitly enabled.
  if (process.env.REMINDER_ENABLED === "1" || process.env.REMINDER_ENABLED === "true") {
    reminders.start();
    console.log("Reminder polling enabled.");
  }
});
