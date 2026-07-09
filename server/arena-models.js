// Agent Arena — model registry service.
//
// The canonical catalog of providers + models lives here on the server, so the
// arena page always loads the current list and future models can be added
// without shipping new client code. The client fetches `GET /api/arena/models`
// on load and polls periodically, auto-adding anything new to the agent list.
//
// Three ways the registry updates itself:
//   1. OpenRouter catalog (OPENROUTER_API_KEY) — if set, the service pulls the
//      full live model list from OpenRouter's /models endpoint, groups it by
//      provider, and swaps it in. This is the "add every model on OpenRouter"
//      path: hundreds of real models with real slugs + pricing, refreshed on a
//      timer so new releases appear automatically.
//   2. Upstream feed (ARENA_MODELS_URL) — a custom JSON feed (same shape as
//      `providers` below). Takes precedence over OpenRouter when both are set.
//   3. Demo release simulation — with no feed configured, the service promotes
//      one model from a small "upcoming" pool on a timer, so the auto-update is
//      visible in the demo. These are illustrative, not real product
//      announcements (the arena page is labeled demo-mode throughout).

// The base catalog (early-2026 snapshot). Same shape the client renders.
export const BASE_PROVIDERS = {
  OpenAI: {
    color: "#10a37f",
    models: [
      { id: "gpt-5.1", name: "GPT-5.1", costPer1k: 0.01, latency: 1.6, trend: "🔥 New" },
      { id: "gpt-5", name: "GPT-5", costPer1k: 0.01, latency: 1.8 },
      { id: "gpt-5-mini", name: "GPT-5 mini", costPer1k: 0.002, latency: 0.9 },
      { id: "gpt-5-nano", name: "GPT-5 nano", costPer1k: 0.0004, latency: 0.5 },
      { id: "o4-mini", name: "o4-mini", costPer1k: 0.004, latency: 1.4 },
      { id: "gpt-4.1", name: "GPT-4.1", costPer1k: 0.008, latency: 1.2 },
    ],
  },
  Anthropic: {
    color: "#d97757",
    models: [
      { id: "claude-opus-4.5", name: "Claude Opus 4.5", costPer1k: 0.025, latency: 1.9, trend: "🔥 New" },
      { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", costPer1k: 0.015, latency: 1.3 },
      { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", costPer1k: 0.005, latency: 0.6 },
      { id: "claude-opus-4.1", name: "Claude Opus 4.1", costPer1k: 0.075, latency: 2.2 },
    ],
  },
  Google: {
    color: "#4285f4",
    models: [
      { id: "gemini-3-pro", name: "Gemini 3 Pro", costPer1k: 0.012, latency: 1.7, trend: "🔥 New" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", costPer1k: 0.01, latency: 1.5 },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", costPer1k: 0.0025, latency: 0.7 },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", costPer1k: 0.0004, latency: 0.4 },
    ],
  },
  Meta: {
    color: "#e65c2e",
    models: [
      { id: "llama-4-maverick", name: "Llama 4 Maverick", costPer1k: 0.0006, latency: 1.1 },
      { id: "llama-4-scout", name: "Llama 4 Scout", costPer1k: 0.0003, latency: 0.8 },
      { id: "llama-3.3-70b", name: "Llama 3.3 70B", costPer1k: 0.0007, latency: 1.4 },
      { id: "llama-3.1-8b", name: "Llama 3.1 8B", costPer1k: 0.0002, latency: 0.6 },
    ],
  },
  xAI: {
    color: "#000000",
    models: [
      { id: "grok-4.1", name: "Grok 4.1", costPer1k: 0.015, latency: 1.6, trend: "🔥 New" },
      { id: "grok-4", name: "Grok 4", costPer1k: 0.015, latency: 1.8 },
      { id: "grok-4-fast", name: "Grok 4 Fast", costPer1k: 0.0005, latency: 0.6 },
    ],
  },
  DeepSeek: {
    color: "#4d6bfe",
    models: [
      { id: "deepseek-v3.2", name: "DeepSeek-V3.2", costPer1k: 0.0004, latency: 1.2 },
      { id: "deepseek-r1", name: "DeepSeek-R1", costPer1k: 0.002, latency: 2.0 },
    ],
  },
  Mistral: {
    color: "#f7a71e",
    models: [
      { id: "mistral-large-3", name: "Mistral Large 3", costPer1k: 0.006, latency: 1.5 },
      { id: "mistral-medium-3", name: "Mistral Medium 3", costPer1k: 0.002, latency: 1.0 },
      { id: "mistral-small-3.2", name: "Mistral Small 3.2", costPer1k: 0.0003, latency: 0.6 },
      { id: "magistral", name: "Magistral", costPer1k: 0.005, latency: 1.7 },
    ],
  },
  Cohere: {
    color: "#ff6b6b",
    models: [
      { id: "command-a", name: "Command A", costPer1k: 0.01, latency: 1.3 },
      { id: "command-r-plus", name: "Command R+", costPer1k: 0.01, latency: 1.6 },
    ],
  },
  AI21: {
    color: "#00a3e0",
    models: [
      { id: "jamba-1.7-large", name: "Jamba 1.7 Large", costPer1k: 0.008, latency: 1.8 },
      { id: "jamba-1.7-mini", name: "Jamba 1.7 Mini", costPer1k: 0.0004, latency: 0.8 },
    ],
  },
  "Alibaba (Qwen)": {
    color: "#ff6a00",
    models: [
      { id: "qwen3-235b", name: "Qwen3 235B", costPer1k: 0.0009, latency: 1.6 },
      { id: "qwen3-32b", name: "Qwen3 32B", costPer1k: 0.0004, latency: 0.9 },
      { id: "qwq-32b", name: "QwQ 32B", costPer1k: 0.0004, latency: 1.3 },
    ],
  },
  Perplexity: {
    color: "#1f1f1f",
    models: [
      { id: "sonar-pro", name: "Sonar Pro", costPer1k: 0.009, latency: 1.4 },
      { id: "sonar", name: "Sonar", costPer1k: 0.001, latency: 0.7 },
    ],
  },
  Community: {
    color: "#7c3aed",
    models: [
      { id: "hermes-4", name: "Hermes 4", costPer1k: 0.001, latency: 0.8, trend: "🔥 +2650%" },
      { id: "openhermes", name: "OpenHermes", costPer1k: 0.0006, latency: 0.9 },
      { id: "dolphin-3", name: "Dolphin 3.0", costPer1k: 0.0005, latency: 1.0 },
    ],
  },
};

// The "upcoming" pool the demo release simulation promotes over time. Each is a
// plausible next release; flagged 🆕 New so the client badges it on arrival.
export const UPCOMING_MODELS = [
  { provider: "OpenAI", id: "gpt-5.2", name: "GPT-5.2", costPer1k: 0.011, latency: 1.6, trend: "🆕 New" },
  { provider: "Anthropic", id: "claude-opus-4.6", name: "Claude Opus 4.6", costPer1k: 0.026, latency: 1.9, trend: "🆕 New" },
  { provider: "Google", id: "gemini-3-flash", name: "Gemini 3 Flash", costPer1k: 0.003, latency: 0.6, trend: "🆕 New" },
  { provider: "Meta", id: "llama-4-behemoth", name: "Llama 4 Behemoth", costPer1k: 0.001, latency: 1.6, trend: "🆕 New" },
  { provider: "xAI", id: "grok-4.2", name: "Grok 4.2", costPer1k: 0.015, latency: 1.5, trend: "🆕 New" },
  { provider: "DeepSeek", id: "deepseek-v4", name: "DeepSeek-V4", costPer1k: 0.0005, latency: 1.1, trend: "🆕 New" },
  { provider: "Mistral", id: "mistral-large-3.1", name: "Mistral Large 3.1", costPer1k: 0.006, latency: 1.4, trend: "🆕 New" },
  { provider: "Community", id: "hermes-5", name: "Hermes 5", costPer1k: 0.001, latency: 0.7, trend: "🆕 New" },
];

// Deep clone the base catalog (structuredClone is available on Node 20+).
const cloneProviders = (p) => structuredClone(p);

// Basic shape validation for an upstream feed payload.
export function isValidCatalog(providers) {
  if (!providers || typeof providers !== "object") return false;
  const entries = Object.entries(providers);
  if (!entries.length) return false;
  return entries.every(([name, info]) =>
    name && info && typeof info.color === "string" &&
    Array.isArray(info.models) &&
    info.models.every((m) => m && typeof m.id === "string" && typeof m.name === "string"));
}

// --- OpenRouter catalog ingestion -----------------------------------------
// OpenRouter's GET /api/v1/models returns { data: [ { id: "vendor/model",
// name: "Vendor: Model", pricing: { prompt, completion }, context_length,
// created } ] }. We group those by vendor into the same `providers` shape the
// rest of the app renders, so a single OPENROUTER_API_KEY lists every model
// OpenRouter serves — with the exact slugs the run adapter needs (no guessing).

// Known vendor slugs → display name + brand color. Anything not listed still
// appears; its name is derived from the model label and its color from a palette.
const OR_PROVIDER_META = {
  openai: { name: "OpenAI", color: "#10a37f" },
  anthropic: { name: "Anthropic", color: "#d97757" },
  google: { name: "Google", color: "#4285f4" },
  "meta-llama": { name: "Meta", color: "#e65c2e" },
  "x-ai": { name: "xAI", color: "#000000" },
  deepseek: { name: "DeepSeek", color: "#4d6bfe" },
  mistralai: { name: "Mistral", color: "#f7a71e" },
  cohere: { name: "Cohere", color: "#ff6b6b" },
  perplexity: { name: "Perplexity", color: "#1f1f1f" },
  qwen: { name: "Alibaba (Qwen)", color: "#ff6a00" },
  ai21: { name: "AI21", color: "#00a3e0" },
  nousresearch: { name: "Nous Research", color: "#7c3aed" },
  microsoft: { name: "Microsoft", color: "#0078d4" },
  nvidia: { name: "NVIDIA", color: "#76b900" },
  amazon: { name: "Amazon", color: "#ff9900" },
  "z-ai": { name: "Z.AI", color: "#2563eb" },
  moonshotai: { name: "Moonshot AI", color: "#111827" },
  "01-ai": { name: "01.AI", color: "#16a34a" },
};

const OR_PALETTE = [
  "#7c3aed", "#0ea5e9", "#14b8a6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#22c55e", "#ec4899", "#64748b", "#6366f1",
];

function paletteColor(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return OR_PALETTE[h % OR_PALETTE.length];
}

function titleCase(slug) {
  return String(slug).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Blend prompt + completion per-token USD prices into a headline cost per 1k.
function pricePer1k(pricing) {
  const p = Number(pricing?.prompt);
  const c = Number(pricing?.completion);
  const parts = [p, c].filter((x) => Number.isFinite(x) && x > 0);
  const perToken = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  return Math.round(perToken * 1000 * 1e6) / 1e6; // per 1k tokens, 6 dp
}

export function openRouterToCatalog(body, { limit = 0, defaultLatency = 1.0, now = Date.now() } = {}) {
  const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  const providers = {};
  let count = 0;
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || !row.id.includes("/")) continue;
    if (limit && count >= limit) break;
    const slug = row.id.slice(0, row.id.indexOf("/"));
    const meta = OR_PROVIDER_META[slug];
    const label = typeof row.name === "string" ? row.name : "";
    const labelProvider = label.includes(":") ? label.split(":")[0].trim() : "";
    const providerName = meta?.name || labelProvider || titleCase(slug);
    const color = meta?.color || paletteColor(slug);
    if (!providers[providerName]) providers[providerName] = { color, models: [] };
    // Strip the "Vendor: " prefix from the model label for a clean display name.
    let modelName = label;
    if (labelProvider) modelName = label.slice(label.indexOf(":") + 1).trim();
    modelName = modelName || row.id;
    const model = { id: row.id, name: modelName, costPer1k: pricePer1k(row.pricing), latency: defaultLatency };
    if (row.context_length) model.context = Number(row.context_length);
    if (row.created && now - row.created * 1000 < 45 * 24 * 3600 * 1000) model.trend = "🆕 New";
    if (providers[providerName].models.some((m) => m.id === model.id)) continue;
    providers[providerName].models.push(model);
    count++;
  }
  return providers;
}

export function createArenaModels({
  upstreamUrl = "",
  openrouterKey = "",
  openrouterUrl = "https://openrouter.ai/api/v1/models",
  openrouterReferer = "https://echodeck.madlabs.uk/arena",
  openrouterLimit = 0,
  refreshMs = 60 * 60 * 1000,
  releaseIntervalMs = 90 * 1000,
  upcoming = UPCOMING_MODELS,
  fetchImpl,
  autoStart = true,
} = {}) {
  let providers = cloneProviders(BASE_PROVIDERS);
  let version = 1;
  let updatedAt = Date.now();
  const queue = upcoming.slice();
  let timer = null;

  const doFetch = fetchImpl || globalThis.fetch;
  // A custom feed (ARENA_MODELS_URL) wins over OpenRouter when both are set.
  const useOpenRouter = Boolean(openrouterKey) && !upstreamUrl;
  const feedEnabled = Boolean(upstreamUrl) || useOpenRouter;

  const modelIds = (p) => new Set(Object.values(p).flatMap((info) => info.models.map((m) => m.id)));

  // Promote the next upcoming model into the live catalog (demo release path).
  function promoteNext() {
    const next = queue.shift();
    if (!next) return null;
    const { provider, ...model } = next;
    if (!providers[provider]) return promoteNext(); // provider gone; skip
    if (providers[provider].models.some((m) => m.id === model.id)) return promoteNext();
    providers[provider].models.push(model);
    version += 1;
    updatedAt = Date.now();
    return { provider, ...model };
  }

  // Pull the catalog from an upstream feed and swap it in if it validates and
  // actually changed. Never throws — a bad/unreachable feed leaves the current
  // catalog untouched.
  async function refresh() {
    if (!feedEnabled || !doFetch) return { changed: false };
    try {
      let next = null;
      if (upstreamUrl) {
        const res = await doFetch(upstreamUrl, { headers: { accept: "application/json" } });
        if (!res.ok) return { changed: false };
        const body = await res.json();
        next = body?.providers ?? body;
      } else {
        // OpenRouter live catalog.
        const res = await doFetch(openrouterUrl, {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${openrouterKey}`,
            "HTTP-Referer": openrouterReferer,
            "X-Title": "Agent Arena",
          },
        });
        if (!res.ok) return { changed: false };
        const body = await res.json();
        next = openRouterToCatalog(body, { limit: openrouterLimit });
      }
      if (!isValidCatalog(next)) return { changed: false };
      const before = modelIds(providers);
      const after = modelIds(next);
      const changed = before.size !== after.size || [...after].some((id) => !before.has(id));
      if (changed) {
        providers = cloneProviders(next);
        version += 1;
        updatedAt = Date.now();
      }
      return { changed };
    } catch {
      return { changed: false };
    }
  }

  function start() {
    if (timer) return;
    if (feedEnabled) {
      // Load the live catalog immediately on boot, then refresh on a timer.
      refresh();
      timer = setInterval(() => { refresh(); }, refreshMs);
    } else if (releaseIntervalMs > 0 && queue.length) {
      timer = setInterval(() => { promoteNext(); }, releaseIntervalMs);
    }
    // Don't let the timer keep the process (or a test run) alive.
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  if (autoStart) start();

  return {
    get: () => ({ version, updatedAt, providers }),
    promoteNext,
    refresh,
    start,
    stop,
    enabled: feedEnabled,
    source: upstreamUrl ? "feed" : useOpenRouter ? "openrouter" : "demo",
  };
}
