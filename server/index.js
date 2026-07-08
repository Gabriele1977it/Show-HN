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
import { createMailer } from "./email.js";
import { createEnricher } from "./enrich.js";
import { createTranscriber } from "./transcribe.js";
import { createImporter } from "./importer.js";
import { createPushService, deliverToWorkspace } from "./push.js";
import { createArenaModels } from "./arena-models.js";
import { createArenaRunner, createAnthropicAdapter, createOpenAICompatibleAdapter, createGeminiAdapter } from "./arena-run.js";
import { createArenaJudge, createAnthropicJudge } from "./arena-judge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.ECHODECK_DATA || join(ROOT, "data", "db.json");
const UPLOADS_DIR = process.env.ECHODECK_UPLOADS || join(ROOT, "uploads");

// Storage: SQLite by default (durable, indexed), importing any existing JSON
// data on first boot. Set STORE=json to keep the simple JSON file store.
let store;
if (process.env.STORE === "json") {
  store = createStore(DATA_FILE);
  console.log("Store: JSON file.");
} else {
  const { createSqliteStore } = await import("./store-sqlite.js");
  const DB_FILE = process.env.ECHODECK_DB || join(ROOT, "data", "echodeck.db");
  store = createSqliteStore(DB_FILE, { migrateFrom: DATA_FILE });
  console.log(`Store: SQLite (${DB_FILE}).`);
}

// Web Push: enabled when VAPID keys are set. Generate them once with
// `npx web-push generate-vapid-keys` and put them in .env.
const push = createPushService({
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
});

// Reminders: deliver via REMINDER_WEBHOOK_URL when set (ntfy / Slack / email
// relay), otherwise log to the console so the surface is always inspectable.
// Also fans out to any push subscriptions for the workspace when push is on.
const baseNotify = process.env.REMINDER_WEBHOOK_URL
  ? webhookNotifier(process.env.REMINDER_WEBHOOK_URL)
  : consoleNotifier();
const reminders = createReminderService({
  store,
  notify: async (message, workspaceId) => {
    const base = await baseNotify(message, workspaceId);
    if (push.enabled && workspaceId) return { base, push: await deliverToWorkspace({ store, push, workspaceId, message }) };
    return base;
  },
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
    priceProYear: process.env.STRIPE_PRICE_PRO_ANNUAL,
    priceTeamYear: process.env.STRIPE_PRICE_TEAM_ANNUAL,
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

// Email: Resend (RESEND_API_KEY + EMAIL_FROM) or a webhook relay
// (EMAIL_WEBHOOK_URL); with neither set it logs (dev).
const mailer = createMailer({
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM,
  webhookUrl: process.env.EMAIL_WEBHOOK_URL,
});

// AI card-back fill: enabled when an Anthropic API key is present. Model is
// configurable via ECHODECK_LLM_MODEL.
const enrich = createEnricher({ apiKey: process.env.ANTHROPIC_API_KEY });

// Auto-transcription: POST audio URLs to TRANSCRIBE_WEBHOOK_URL (Whisper/Deepgram/
// AssemblyAI/etc. via a relay). Disabled + hidden when unset.
const transcribe = createTranscriber({ webhookUrl: process.env.TRANSCRIBE_WEBHOOK_URL });

// URL / YouTube import: needs only outbound network (no API key), so it's on by
// default. Set ECHODECK_IMPORT_DISABLED=1 to turn the feature (and its UI) off.
const importer = process.env.ECHODECK_IMPORT_DISABLED === "1"
  ? { enabled: false }
  : createImporter({ apiKey: process.env.SUPADATA_API_KEY });

// Agent Arena model registry. Point ARENA_MODELS_URL at a live feed to auto-add
// real future models; otherwise a demo release simulation adds them over time
// (cadence tunable via ARENA_RELEASE_INTERVAL_MS).
const arenaModels = createArenaModels({
  upstreamUrl: process.env.ARENA_MODELS_URL || "",
  ...(process.env.ARENA_RELEASE_INTERVAL_MS ? { releaseIntervalMs: Number(process.env.ARENA_RELEASE_INTERVAL_MS) } : {}),
});

// Agent Arena live runs (opt-in): only when ARENA_LIVE is on AND a provider key
// is set. Otherwise the arena stays fully simulated (no spend). Anthropic is
// wired here (reusing ANTHROPIC_API_KEY); other providers are pluggable.
const arenaLive = process.env.ARENA_LIVE === "1" || process.env.ARENA_LIVE === "true";
const arenaAdapters = {};
if (arenaLive && process.env.ANTHROPIC_API_KEY) {
  const anthropicAdapter = await createAnthropicAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultModel: process.env.ARENA_ANTHROPIC_MODEL || process.env.ECHODECK_LLM_MODEL || "claude-haiku-4-5-20251001",
    // Map arena model ids → real Anthropic API model strings (override via env).
    resolveModel: (id) => ({
      "claude-opus-4.5": process.env.ARENA_ANTHROPIC_OPUS,
      "claude-sonnet-4.5": process.env.ARENA_ANTHROPIC_SONNET,
      "claude-haiku-4.5": process.env.ARENA_ANTHROPIC_HAIKU,
    })[id] || process.env.ARENA_ANTHROPIC_MODEL || undefined,
  });
  if (anthropicAdapter) arenaAdapters["Anthropic"] = anthropicAdapter;
}
// Optional arena model-id → real API model-string map (JSON), shared by the
// OpenAI/xAI/Gemini adapters (their arena ids may not match real API strings).
let arenaModelMap = {};
try { arenaModelMap = JSON.parse(process.env.ARENA_MODEL_MAP || "{}"); } catch { /* ignore bad JSON */ }
const mapModel = (id) => arenaModelMap[id] || id;
if (arenaLive && process.env.OPENAI_API_KEY) {
  arenaAdapters["OpenAI"] = createOpenAICompatibleAdapter({
    apiKey: process.env.OPENAI_API_KEY, baseURL: "https://api.openai.com/v1",
    resolveModel: mapModel, defaultModel: process.env.ARENA_OPENAI_MODEL || "gpt-4o",
  });
}
if (arenaLive && process.env.XAI_API_KEY) {
  arenaAdapters["xAI"] = createOpenAICompatibleAdapter({
    apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1",
    resolveModel: mapModel, defaultModel: process.env.ARENA_XAI_MODEL || "grok-4",
  });
}
if (arenaLive && (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)) {
  arenaAdapters["Google"] = createGeminiAdapter({
    apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    resolveModel: mapModel, defaultModel: process.env.ARENA_GOOGLE_MODEL || "gemini-2.5-flash",
  });
}
const arenaRun = createArenaRunner({ adapters: arenaAdapters, enabled: arenaLive });

// LLM-as-judge: scores real outputs so live runs get a defended score. On when
// live runs are on and a key is set (unless ARENA_JUDGE=0). Reuses ANTHROPIC_API_KEY.
const judgeOff = process.env.ARENA_JUDGE === "0" || process.env.ARENA_JUDGE === "false";
const judgeFn = (arenaLive && !judgeOff && process.env.ANTHROPIC_API_KEY)
  ? await createAnthropicJudge({ apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ARENA_JUDGE_MODEL || "claude-haiku-4-5-20251001" })
  : null;
const arenaJudge = createArenaJudge({ judge: judgeFn, model: process.env.ARENA_JUDGE_MODEL || "" });

const app = createApp({
  store, uploadsDir: UPLOADS_DIR, reminders, billing, mailer, enrich, transcribe, importer, push, arenaModels, arenaRun, arenaJudge, ownerEmails,
  // Cost backstop: max AI card fills per workspace per day (default 300).
  aiLimits: { perWorkspacePerDay: Number(process.env.ECHODECK_AI_DAILY_LIMIT) || undefined },
});

const server = app.listen(PORT, () => {
  console.log(`EchoDeck running on http://localhost:${PORT}`);
  console.log(billing.enabled ? "Stripe billing enabled." : "Billing in dev mode (no Stripe keys).");
  console.log(enrich.enabled
    ? `AI card fill enabled (model: ${enrich.model}, max ${enrich.maxTokens} tokens/call, ${Number(process.env.ECHODECK_AI_DAILY_LIMIT) || 300} fills/workspace/day).`
    : "AI card fill disabled (no ANTHROPIC_API_KEY).");
  console.log(transcribe.enabled ? "Auto-transcription enabled." : "Auto-transcription disabled (no TRANSCRIBE_WEBHOOK_URL).");
  console.log(importer.enabled ? `URL / YouTube import enabled${process.env.SUPADATA_API_KEY ? " (Supadata transcript API)" : " (free best-effort)"}.` : "URL / YouTube import disabled (ECHODECK_IMPORT_DISABLED).");
  console.log(push.enabled ? "Web Push enabled." : "Web Push disabled (no VAPID keys).");
  console.log(arenaModels.enabled ? "Agent Arena model feed enabled (ARENA_MODELS_URL)." : "Agent Arena models: built-in catalog + demo release simulation.");
  console.log(arenaRun.enabled ? `Agent Arena live runs ENABLED (providers: ${arenaRun.providers().join(", ")}).` : "Agent Arena live runs disabled (simulated). Set ARENA_LIVE=1 + a provider key to enable.");
  console.log(arenaJudge.enabled ? "Agent Arena LLM judge ENABLED (real scores on live runs)." : "Agent Arena LLM judge off (simulated scores).");
  console.log(mailer.enabled ? `Email enabled (${mailer.mode}).` : "Email in dev mode (logs only — set RESEND_API_KEY + EMAIL_FROM to send).");
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
