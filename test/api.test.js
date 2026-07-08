import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../server/store.js";
import { createSqliteStore } from "../server/store-sqlite.js";
import { createApp } from "../server/app.js";
import { createArenaRunner } from "../server/arena-run.js";
import { createReminderService } from "../server/reminders.js";
import { createBilling } from "../server/billing.js";
import { createMailer } from "../server/email.js";
import { createEnricher } from "../server/enrich.js";
import { createTranscriber } from "../server/transcribe.js";
import { createPushService } from "../server/push.js";

let server, base, tmp, sentReminders, sentPush, sentEmails, realFetch, wsKey;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "echodeck-"));
  // Run the whole HTTP suite against either store (ECHODECK_TEST_STORE=sqlite).
  const store = process.env.ECHODECK_TEST_STORE === "sqlite"
    ? createSqliteStore(join(tmp, "echodeck.db"))
    : createStore(join(tmp, "db.json"));
  sentReminders = [];
  const reminders = createReminderService({
    store,
    notify: async (msg) => { sentReminders.push(msg); return { ok: true }; },
    config: { minIntervalMs: 1e9 },
  });
  const billing = createBilling({ store, config: {} }); // dev mode (no Stripe keys)
  // Dev-mode mailer (enabled=false, so reset devLink still works), wrapped to
  // capture every message sent — invitations, resets — for assertions.
  sentEmails = [];
  const devMailer = createMailer({ log: () => {} });
  const mailer = { get enabled() { return devMailer.enabled; }, send: async (m) => { sentEmails.push(m); return devMailer.send(m); } };
  // Inject a fake generator so the AI-fill flow is exercised without a live key.
  const enrich = createEnricher({ generate: async (front, language) => ({ back: `EN:${front}`, notes: `note(${language})` }) });
  // Fake transcriber so the auto-transcription flow is exercised without a provider.
  const transcribe = createTranscriber({ transcribe: async (audioUrl) => ({ segments: [{ start: 0, end: 3, text: `heard from ${audioUrl}` }, { start: 3, end: 6, text: "second line" }] }) });
  // Fake importer so the URL/YouTube import route is exercised without network.
  const importer = {
    enabled: true,
    run: async (url) => url.includes("bad")
      ? { error: "no-captions" }
      : { source: "youtube", videoId: "dQw4w9WgXcQ", title: "Imported", language: "es", availableLangs: ["es", "en"], transcript: "[00:00] Hola mundo.\n[00:04] Buenos dias." },
  };
  // Capturing push sender so Web Push plumbing is exercised without a push service.
  sentPush = [];
  const push = createPushService({ publicKey: "test-vapid-key", send: async (sub, payload) => { sentPush.push({ sub, payload }); } });
  const ownerEmails = new Set(["owner@echodeck.app"]);
  const app = createApp({ store, uploadsDir: join(tmp, "uploads"), reminders, billing, mailer, enrich, transcribe, importer, push, ownerEmails });
  await new Promise((res) => { server = app.listen(0, res); });
  base = `http://127.0.0.1:${server.address().port}`;

  // Default workspace for the suite; auto-inject its key on scoped /api calls so
  // existing test bodies don't have to thread auth headers everywhere. Put it on
  // the Team plan so feature/limit gates don't interfere with feature tests.
  const ws = store.createWorkspace({ name: "Test WS" });
  wsKey = ws.key;
  store.setWorkspacePlan(ws.id, "team");
  realFetch = globalThis.fetch;
  globalThis.fetch = (url, opts = {}) => {
    const scoped = typeof url === "string" && url.startsWith(base) &&
      url.includes("/api/") && !url.includes("/api/shared") && !url.includes("/api/workspaces");
    if (scoped) opts = { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${wsKey}` } };
    return realFetch(url, opts);
  };
});

after(() => {
  if (realFetch) globalThis.fetch = realFetch;
  server?.close();
  rmSync(tmp, { recursive: true, force: true });
});

const j = (r) => r.json();

test("API requires a valid workspace key", async () => {
  // realFetch bypasses the auto-auth wrapper, so no Authorization header.
  const noKey = await realFetch(`${base}/api/decks`);
  assert.equal(noKey.status, 401);
  const badKey = await realFetch(`${base}/api/decks`, { headers: { Authorization: "Bearer nope" } });
  assert.equal(badKey.status, 401);
});

test("workspaces are isolated: one cannot see or touch another's decks", async () => {
  // Create a deck in the suite's default workspace.
  const mine = await fetch(`${base}/api/decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Mine", transcript: "[00:00] secret" }),
  }).then(j);

  // A second workspace with its own key.
  const other = await realFetch(`${base}/api/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Other" }),
  }).then(j);
  const auth = { Authorization: `Bearer ${other.key}` };

  // Other workspace sees an empty deck list and 404s on my deck.
  const otherDecks = await realFetch(`${base}/api/decks`, { headers: auth }).then(j);
  assert.ok(!otherDecks.find((d) => d.id === mine.id), "other workspace cannot list my deck");
  assert.equal((await realFetch(`${base}/api/decks/${mine.id}`, { headers: auth })).status, 404);
  assert.equal((await realFetch(`${base}/api/decks/${mine.id}`, { method: "DELETE", headers: auth })).status, 404);

  // My deck is still intact from my workspace.
  assert.equal((await fetch(`${base}/api/decks/${mine.id}`)).status, 200);
});

test("accounts: signup creates a workspace, login returns the keychain", async () => {
  const signup = await realFetch(`${base}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "Creator@Example.com", password: "supersecret" }),
  });
  assert.equal(signup.status, 201);
  const s = await signup.json();
  assert.ok(s.token && s.key);
  assert.equal(s.email, "creator@example.com"); // normalised
  assert.equal(s.account.keychain.length, 1);
  assert.equal(s.account.keychain[0].role, "admin");

  // The returned member key works against the deck API.
  const decks = await realFetch(`${base}/api/decks`, { headers: { Authorization: `Bearer ${s.key}` } });
  assert.equal(decks.status, 200);

  // Duplicate signup is rejected; weak inputs are rejected.
  assert.equal((await realFetch(`${base}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "creator@example.com", password: "anotherpw" }),
  })).status, 409);
  assert.equal((await realFetch(`${base}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bad", password: "x" }),
  })).status, 400);

  // Login with the right and wrong password.
  const login = await realFetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "creator@example.com", password: "supersecret" }),
  }).then(j);
  assert.ok(login.token);
  assert.equal(login.account.keychain.length, 1);
  assert.equal((await realFetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "creator@example.com", password: "nope" }),
  })).status, 401);

  // Session-scoped account access; logout invalidates it.
  const sess = { "X-Session": login.token };
  assert.equal((await realFetch(`${base}/api/account`, { headers: sess })).status, 200);
  assert.equal((await realFetch(`${base}/api/account`)).status, 401);
  assert.equal((await realFetch(`${base}/api/auth/logout`, { method: "POST", headers: sess })).status, 204);
  assert.equal((await realFetch(`${base}/api/account`, { headers: sess })).status, 401);
});

test("accounts: keychain accumulates joined workspaces", async () => {
  const s = await realFetch(`${base}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "joiner@example.com", password: "passw0rd" }),
  }).then(j);
  // A separate workspace whose key the user joins.
  const other = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Shared studio" }),
  }).then(j);

  const saved = await realFetch(`${base}/api/account/keys`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Session": s.token },
    body: JSON.stringify({ memberKey: other.key }),
  }).then(j);
  assert.equal(saved.keychain.length, 2);
  assert.ok(saved.keychain.some((k) => k.workspaceName === "Shared studio"));

  // Garbage key is rejected.
  assert.equal((await realFetch(`${base}/api/account/keys`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Session": s.token },
    body: JSON.stringify({ memberKey: "garbage" }),
  })).status, 400);
});

test("Free plan enforces limits; upgrading lifts them", async () => {
  const hdr = (key, json) => ({ Authorization: `Bearer ${key}`, ...(json ? { "Content-Type": "application/json" } : {}) });
  const ws = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Free WS" }),
  }).then(j);
  const key = ws.key;
  const mkDeck = (n) => realFetch(`${base}/api/decks`, {
    method: "POST", headers: hdr(key, true), body: JSON.stringify({ title: n, transcript: "[00:00] a" }),
  });

  // Free allows 3 decks; the 4th is blocked with 402 + upgrade flag.
  for (let i = 0; i < 3; i++) assert.equal((await mkDeck(`d${i}`)).status, 201);
  const blocked = await mkDeck("d4");
  assert.equal(blocked.status, 402);
  assert.equal((await blocked.json()).upgrade, true);

  // Paid-only features are gated on Free.
  const decks = await realFetch(`${base}/api/decks`, { headers: hdr(key) }).then(j);
  assert.equal((await realFetch(`${base}/api/decks/${decks[0].id}/share`, { method: "POST", headers: hdr(key) })).status, 402);
  assert.equal((await realFetch(`${base}/api/stats`, { headers: hdr(key) })).status, 402);
  assert.equal((await realFetch(`${base}/api/members`, { method: "POST", headers: hdr(key, true), body: JSON.stringify({ name: "x", role: "viewer" }) })).status, 402);

  // workspace endpoint reports the plan + usage.
  const info = await realFetch(`${base}/api/workspace`, { headers: hdr(key) }).then(j);
  assert.equal(info.plan, "free");
  assert.equal(info.usage.decks, 3);
  assert.equal(info.planInfo.maxDecks, 3);

  // Upgrade via dev-mode checkout, then the limits/features open up.
  const checkout = await realFetch(`${base}/api/billing/checkout`, {
    method: "POST", headers: hdr(key, true), body: JSON.stringify({ plan: "pro" }),
  }).then(j);
  assert.equal(checkout.dev, true);
  assert.equal((await mkDeck("d5")).status, 201); // 4th+ deck now allowed
  assert.equal((await realFetch(`${base}/api/stats`, { headers: hdr(key) })).status, 200);
  const after = await realFetch(`${base}/api/workspace`, { headers: hdr(key) }).then(j);
  assert.equal(after.plan, "pro");
  assert.equal(after.planInfo.maxDecks, null); // unlimited
});

test("owner accounts are auto-comped to the Team plan", async () => {
  const hdr = (key) => ({ Authorization: `Bearer ${key}` });
  // A normal signup lands on Free.
  const normal = await realFetch(`${base}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "normal@example.com", password: "passw0rd" }),
  }).then(j);
  assert.equal((await realFetch(`${base}/api/workspace`, { headers: hdr(normal.key) }).then(j)).plan, "free");

  // The owner email is comped to Team on signup (case-insensitive).
  const owner = await realFetch(`${base}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "Owner@EchoDeck.app", password: "passw0rd" }),
  }).then(j);
  const ownerWs = await realFetch(`${base}/api/workspace`, { headers: hdr(owner.key) }).then(j);
  assert.equal(ownerWs.plan, "team");
  assert.equal(ownerWs.planInfo.maxMembers, 10);

  // A new workspace the owner creates while signed in is also comped.
  const ws2 = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Session": owner.token },
    body: JSON.stringify({ name: "Second" }),
  }).then(j);
  assert.equal((await realFetch(`${base}/api/workspace`, { headers: hdr(ws2.key) }).then(j)).plan, "team");
});

test("billing portal cancels a subscription (dev mode) back to Free", async () => {
  const hdr = (key, json) => ({ Authorization: `Bearer ${key}`, ...(json ? { "Content-Type": "application/json" } : {}) });
  const ws = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Cancel WS" }),
  }).then(j);
  await realFetch(`${base}/api/billing/checkout`, { method: "POST", headers: hdr(ws.key, true), body: JSON.stringify({ plan: "pro" }) });
  assert.equal((await realFetch(`${base}/api/workspace`, { headers: hdr(ws.key) }).then(j)).plan, "pro");

  const portal = await realFetch(`${base}/api/billing/portal`, { method: "POST", headers: hdr(ws.key) }).then(j);
  assert.equal(portal.dev, true);
  assert.equal((await realFetch(`${base}/api/workspace`, { headers: hdr(ws.key) }).then(j)).plan, "free");
});

test("security headers and JSON 404 for unknown API routes", async () => {
  const r = await fetch(`${base}/api/plans`);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.ok(r.headers.get("content-security-policy"));
  const nf = await fetch(`${base}/api/does-not-exist`);
  assert.equal(nf.status, 404);
  assert.equal((await nf.json()).error, "Not found");
});

test("legal pages are served", async () => {
  for (const p of ["/terms", "/privacy"]) {
    const r = await realFetch(`${base}${p}`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /html/);
  }
});

test("landing page is served at /, the app at /app, Agent Arena at /arena", async () => {
  const landing = await realFetch(`${base}/`);
  assert.equal(landing.status, 200);
  const lhtml = await landing.text();
  assert.match(lhtml, /Start free/);
  assert.match(lhtml, /turn native audio/i);

  const app = await realFetch(`${base}/app`);
  assert.equal(app.status, 200);
  assert.match(await app.text(), /id="build-form"/);

  const arena = await realFetch(`${base}/arena`);
  assert.equal(arena.status, 200);
  assert.match(await arena.text(), /Agent Arena/);
});

test("Agent Arena scorecards publish, list, read, and share publicly (no auth)", async () => {
  const payload = {
    task: "Draft Sales Email",
    taskEmoji: "✉️",
    results: [
      { name: "GPT-5.1", provider: "OpenAI", color: "#10a37f", totalScore: 85,
        dimensions: { accuracy: 90, relevance: 88, speedScore: 80, costScore: 75 },
        latency: 1.6, cost: 0.0011, output: "Subject: Quick question…" },
      { name: "Claude Opus 4.5", provider: "Anthropic", color: "#d97757", totalScore: 80,
        dimensions: { accuracy: 84, relevance: 82, speedScore: 78, costScore: 60 },
        latency: 2.1, cost: 0.0025, output: "Subject: Your logistics savings…" },
    ],
  };
  // Publish is public — realFetch bypasses the auto-auth wrapper (no key).
  const pub = await realFetch(`${base}/api/arena/scorecards`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  assert.equal(pub.status, 201);
  const { id } = await pub.json();
  assert.ok(id);

  // Read back the full scorecard, sorted, with the winner first.
  const got = await realFetch(`${base}/api/arena/scorecards/${id}`).then(j);
  assert.equal(got.task, "Draft Sales Email");
  assert.equal(got.winner, "GPT-5.1");
  assert.equal(got.winnerScore, 85);
  assert.equal(got.results.length, 2);
  assert.equal(got.results[0].name, "GPT-5.1");

  // Appears in the public recent list with its emoji + winner.
  const list = await realFetch(`${base}/api/arena/scorecards?limit=8`).then(j);
  const entry = list.find((c) => c.id === id);
  assert.ok(entry);
  assert.equal(entry.taskEmoji, "✉️");
  assert.equal(entry.winner, "GPT-5.1");
  assert.equal(entry.agentCount, 2);

  // Public share page renders with server-injected SEO for the winner.
  const page = await realFetch(`${base}/arena/s/${id}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /GPT-5\.1 wins/);

  // Validation: needs a task and at least two results.
  const bad = await realFetch(`${base}/api/arena/scorecards`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "x", results: [{ name: "solo" }] }),
  });
  assert.equal(bad.status, 400);

  // Unknown id → 404 JSON.
  assert.equal((await realFetch(`${base}/api/arena/scorecards/nope`)).status, 404);
});

test("Agent Arena leaderboard aggregates models and supports search/task filters", async () => {
  const mk = (task, emoji, a, b) => realFetch(`${base}/api/arena/scorecards`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task, taskEmoji: emoji,
      results: [
        { name: a.name, provider: a.prov, color: "#10a37f", totalScore: a.score,
          dimensions: { accuracy: 90, relevance: 88, speedScore: 80, costScore: 75 }, latency: 1.5, cost: 0.001, output: "x" },
        { name: b.name, provider: b.prov, color: "#d97757", totalScore: b.score,
          dimensions: { accuracy: 80, relevance: 78, speedScore: 76, costScore: 60 }, latency: 2.0, cost: 0.002, output: "y" },
      ],
    }),
  });
  // Unique model + task names so this test's aggregate is isolated from
  // scorecards other tests publish into the shared store.
  const A = "Aggregatron-1", B = "Aggregatron-2", TASK = "Aggregation Test Task";
  // Two runs on TASK: A wins both; one run on a second task where B wins.
  await mk(TASK, "📅", { name: A, prov: "OpenAI", score: 88 }, { name: B, prov: "xAI", score: 70 });
  await mk(TASK, "📅", { name: A, prov: "OpenAI", score: 84 }, { name: B, prov: "xAI", score: 79 });
  await mk("Aggregation Test Invoice", "🧾", { name: B, prov: "xAI", score: 91 }, { name: A, prov: "OpenAI", score: 60 });

  const board = await realFetch(`${base}/api/arena/leaderboard`).then(j);
  assert.ok(board.totalScorecards >= 3);
  const modelA = board.models.find((m) => m.name === A);
  assert.ok(modelA);
  assert.equal(modelA.appearances, 3);
  assert.equal(modelA.wins, 2); // won both TASK runs, lost the invoice one
  assert.equal(modelA.winRate, 67);
  assert.ok(board.tasks.some((t) => t.name === TASK && t.count === 2));

  // Task-filtered leaderboard: within TASK, A wins 100%.
  const filtered = await realFetch(`${base}/api/arena/leaderboard?task=${encodeURIComponent(TASK)}`).then(j);
  assert.equal(filtered.totalScorecards, 2);
  assert.equal(filtered.models.find((m) => m.name === A).winRate, 100);

  // Scorecard search by winning model name.
  const search = await realFetch(`${base}/api/arena/scorecards?q=${encodeURIComponent(B)}`).then(j);
  assert.ok(search.length >= 1);
  assert.ok(search.every((c) => new RegExp(B, "i").test(`${c.task} ${c.winner}`)));

  // Scorecard filter by task.
  const byTask = await realFetch(`${base}/api/arena/scorecards?task=${encodeURIComponent(TASK)}`).then(j);
  assert.equal(byTask.length, 2);
  assert.ok(byTask.every((c) => c.task === TASK));

  // Public leaderboard page renders.
  const page = await realFetch(`${base}/arena/leaderboard`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Community leaderboard/);
});

test("Agent Arena blind votes update the community ELO leaderboard", async () => {
  const gpt = { id: "gpt-5.1", name: "GPT-5.1", provider: "OpenAI", color: "#10a37f" };
  const claude = { id: "claude-opus-4.5", name: "Claude Opus 4.5", provider: "Anthropic", color: "#d97757" };
  const vote = (winner) => realFetch(`${base}/api/arena/vote`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "Draft Sales Email", a: gpt, b: claude, winner }),
  });

  const first = await vote("a");
  assert.equal(first.status, 201);
  const body = await first.json();
  assert.equal(body.a.delta, 12);
  assert.equal(body.b.delta, -12);
  assert.ok(body.totalVotes >= 1);

  const lb = await realFetch(`${base}/api/arena/vote/leaderboard`).then(j);
  const g = lb.models.find((m) => m.id === "gpt-5.1");
  assert.ok(g && g.rating > 1500 && g.wins === 1);

  // Validation: bad winner, and same model on both sides, are rejected.
  assert.equal((await vote("nonsense")).status, 400);
  assert.equal((await realFetch(`${base}/api/arena/vote`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "x", a: gpt, b: gpt, winner: "a" }),
  })).status, 400);
});

test("Agent Arena model registry is served and versioned", async () => {
  const models = await realFetch(`${base}/api/arena/models`).then(j);
  assert.equal(typeof models.version, "number");
  assert.equal(typeof models.updatedAt, "number");
  assert.ok(models.providers && models.providers.OpenAI);
  assert.ok(Array.isArray(models.providers.OpenAI.models));
  assert.ok(models.providers.OpenAI.models.some((m) => m.id === "gpt-5.1"));
});

test("POST /api/arena/run: disabled by default; live when a runner is injected", async () => {
  // The suite's app injects no runner → live runs are off, page stays simulated.
  const off = await realFetch(`${base}/api/arena/run`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "hi", models: [{ id: "gpt-5.1", provider: "OpenAI" }] }),
  }).then(j);
  assert.equal(off.enabled, false);

  // A separate app with an injected fake Anthropic adapter + its own store, so
  // we can exercise the SaaS gate (sign-in + credits) and metering end to end.
  const liveTmp = mkdtempSync(join(tmpdir(), "arena-live-"));
  const liveStore = createStore(join(liveTmp, "s.json"));
  const liveApp = createApp({
    store: liveStore,
    uploadsDir: liveTmp,
    ownerEmails: new Set(["boss@arena.test"]),
    billing: createBilling({ store: liveStore, config: {} }), // dev mode (instant)
    arenaCreditsConfig: { markup: 1.5, signupBonusCents: 25 },
    arenaRun: createArenaRunner({
      adapters: {
        Anthropic: async ({ prompt }) => ({ output: `R:${prompt.slice(0, 12)}`, promptTokens: 500, completionTokens: 500 }),
      },
    }),
  });
  const liveServer = liveApp.listen(0);
  const lbase = `http://127.0.0.1:${liveServer.address().port}`;
  const sess = (email) => { const u = liveStore.createUser({ email, password: "secret1" }); return liveStore.createSession(u.id); };
  const post = (path, headers, body) => realFetch(`${lbase}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  }).then(j);
  try {
    const runReq = (headers, body) => post("/api/arena/run", headers, body);

    // Sim-only run: no sign-in, no charge.
    const simOnly = await runReq({}, { prompt: "p", models: [{ id: "gpt-5.1", provider: "OpenAI" }] });
    assert.equal(simOnly.enabled, true);
    assert.equal(simOnly.results[0].live, false);
    assert.equal(simOnly.charged, undefined);

    // Live model, no session → gated for sign-in.
    assert.equal((await runReq({}, { prompt: "p", models: [{ id: "claude-opus-4.5", provider: "Anthropic" }] })).reason, "signin");

    // Signed in but on the FREE plan → real runs are gated ('plan-upgrade').
    const token = sess("buyer@arena.test");
    const auth = { "X-Session": token };
    assert.equal((await runReq(auth, { prompt: "p", models: [{ id: "claude-opus-4.5", provider: "Anthropic" }] })).reason, "plan-upgrade");

    // Upgrade to Pro (dev mode) → plan set + monthly allowance ($5) granted.
    const up = await post("/api/arena/subscribe", auth, { plan: "pro" });
    assert.equal(up.dev, true);
    assert.equal(up.plan, "pro");
    let wallet = await realFetch(`${lbase}/api/arena/credits`, { headers: auth }).then(j);
    assert.equal(wallet.plan, "pro");
    assert.equal(wallet.credits, 500); // allowance

    // Pro can run real models now → charge 4c (1000 tok @ $0.025/1k ×1.5, ceil).
    const on = await runReq(auth, { prompt: "Write a follow-up email", taskId: "sales-email", models: [
      { id: "gpt-5.1", provider: "OpenAI" },
      { id: "claude-opus-4.5", provider: "Anthropic" },
    ] });
    assert.equal(on.enabled, true);
    const byId = Object.fromEntries(on.results.map((r) => [r.id, r]));
    assert.equal(byId["claude-opus-4.5"].live, true);
    assert.equal(byId["gpt-5.1"].live, false);
    assert.equal(on.charged, 4);
    assert.equal(on.balance, 496);

    // Pro caps at 6 models and can't author custom tasks.
    const tooMany = await runReq(auth, { prompt: "p", models: [
      { id: "claude-opus-4.5", provider: "Anthropic" },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `gpt-${i}`, provider: "OpenAI" })),
    ] });
    assert.equal(tooMany.reason, "plan-models");
    assert.equal(tooMany.max, 6);
    assert.equal((await runReq(auth, { prompt: "custom prompt", taskId: "custom", models: [{ id: "claude-opus-4.5", provider: "Anthropic" }] })).reason, "plan-custom");

    // Upgrade to Ultimate → +$20 allowance; custom tasks now allowed.
    await post("/api/arena/subscribe", auth, { plan: "ultimate" });
    wallet = await realFetch(`${lbase}/api/arena/credits`, { headers: auth }).then(j);
    assert.equal(wallet.plan, "ultimate");
    assert.equal(wallet.credits, 496 + 2000);
    const custom = await runReq(auth, { prompt: "my own workflow prompt", taskId: "custom", models: [{ id: "claude-opus-4.5", provider: "Anthropic" }] });
    assert.equal(custom.enabled, true);
    assert.equal(custom.results[0].live, true);
    assert.equal(custom.balance, 496 + 2000 - 4);

    // Owner admin stats include the account's plan + spend.
    const ownerTok = sess("boss@arena.test");
    assert.equal((await realFetch(`${lbase}/api/arena/admin/stats`, { headers: auth })).status, 403);
    const stats = await realFetch(`${lbase}/api/arena/admin/stats`, { headers: { "X-Session": ownerTok } }).then(j);
    assert.equal(stats.totalSpentCents, 8); // two 4c live runs
    const acct = stats.accounts.find((a) => a.email === "buyer@arena.test");
    assert.ok(acct);
    assert.equal(acct.plan, "ultimate");

    // Owner accounts are comped to Ultimate and run for free (no charge).
    const ownerWallet = await realFetch(`${lbase}/api/arena/credits`, { headers: { "X-Session": ownerTok } }).then(j);
    assert.equal(ownerWallet.plan, "ultimate");
    const ownerRun = await post("/api/arena/run", { "X-Session": ownerTok }, {
      prompt: "owner custom prompt", taskId: "custom", models: [{ id: "claude-opus-4.5", provider: "Anthropic" }],
    });
    assert.equal(ownerRun.enabled, true);          // Ultimate → custom allowed
    assert.equal(ownerRun.results[0].live, true);
    assert.equal(ownerRun.charged, 0);              // owners aren't billed

    // Public plans catalogue.
    const plans = await realFetch(`${lbase}/api/arena/plans`).then(j);
    assert.deepEqual(plans.map((p) => p.id), ["free", "pro", "ultimate"]);

    // Validation still applies.
    assert.equal((await realFetch(`${lbase}/api/arena/run`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "", models: [] }),
    })).status, 400);
  } finally {
    liveServer.close();
    liveStore.close?.();
    rmSync(liveTmp, { recursive: true, force: true });
  }
});

test("plans catalog is public", async () => {
  const plans = await realFetch(`${base}/api/plans`).then(j);
  assert.deepEqual(plans.map((p) => p.id), ["free", "pro", "team"]);
  assert.equal(plans.find((p) => p.id === "pro").features.sharing, true);
});

test("password reset: request → reset → new password works, sessions invalidated", async () => {
  const signup = await realFetch(`${base}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "reset-me@example.com", password: "oldpassword" }),
  }).then(j);
  const oldSession = signup.token;

  // Unknown email: still 200, but no dev link (no enumeration).
  const ghost = await realFetch(`${base}/api/auth/request-reset`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "nobody@example.com" }),
  }).then(j);
  assert.equal(ghost.ok, true);
  assert.equal(ghost.devLink, undefined);

  // Real email: dev mode returns the link so we can extract the token.
  const req = await realFetch(`${base}/api/auth/request-reset`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "reset-me@example.com" }),
  }).then(j);
  assert.ok(req.devLink);
  const token = new URL(req.devLink).searchParams.get("token");

  // Too-short password is rejected.
  assert.equal((await realFetch(`${base}/api/auth/reset`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: "x" }),
  })).status, 400);

  // Valid reset succeeds.
  assert.equal((await realFetch(`${base}/api/auth/reset`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: "newpassword" }),
  })).status, 200);

  // Old password fails; new one works; the token can't be reused.
  assert.equal((await realFetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "reset-me@example.com", password: "oldpassword" }),
  })).status, 401);
  assert.equal((await realFetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "reset-me@example.com", password: "newpassword" }),
  })).status, 200);
  assert.equal((await realFetch(`${base}/api/auth/reset`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: "anotherpw" }),
  })).status, 400);

  // The pre-reset session was invalidated.
  assert.equal((await realFetch(`${base}/api/account`, { headers: { "X-Session": oldSession } })).status, 401);
});

test("member roles: viewers are read-only, members are admin-managed", async () => {
  const hdr = (key, json) => ({ Authorization: `Bearer ${key}`, ...(json ? { "Content-Type": "application/json" } : {}) });
  const admin = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Roles WS" }),
  }).then(j);
  // Upgrade to Team (dev-mode checkout applies immediately) so members are allowed.
  await realFetch(`${base}/api/billing/checkout`, {
    method: "POST", headers: hdr(admin.key, true), body: JSON.stringify({ plan: "team" }),
  });

  // Admin mints an editor and a viewer key.
  const editor = await realFetch(`${base}/api/members`, {
    method: "POST", headers: hdr(admin.key, true), body: JSON.stringify({ name: "Ed", role: "editor" }),
  }).then(j);
  const viewer = await realFetch(`${base}/api/members`, {
    method: "POST", headers: hdr(admin.key, true), body: JSON.stringify({ name: "Vi", role: "viewer" }),
  }).then(j);
  assert.ok(editor.key && viewer.key);
  assert.equal(editor.role, "editor");

  const makeDeck = (key) => realFetch(`${base}/api/decks`, {
    method: "POST", headers: hdr(key, true), body: JSON.stringify({ title: "T", transcript: "[00:00] x" }),
  });

  // Viewer: GET works, writes are 403.
  assert.equal((await realFetch(`${base}/api/decks`, { headers: hdr(viewer.key) })).status, 200);
  assert.equal((await makeDeck(viewer.key)).status, 403);

  // Editor: can write decks but cannot manage members.
  assert.equal((await makeDeck(editor.key)).status, 201);
  const editorAddsMember = await realFetch(`${base}/api/members`, {
    method: "POST", headers: hdr(editor.key, true), body: JSON.stringify({ name: "X", role: "viewer" }),
  });
  assert.equal(editorAddsMember.status, 403);

  // Admin: lists 3 members, removes the viewer, but cannot remove the last admin.
  const members = await realFetch(`${base}/api/members`, { headers: hdr(admin.key) }).then(j);
  assert.equal(members.length, 3);
  assert.ok(!members.some((m) => "key" in m), "member list never leaks keys");
  assert.equal((await realFetch(`${base}/api/members/${viewer.id}`, { method: "DELETE", headers: hdr(admin.key) })).status, 204);
  const owner = members.find((m) => m.role === "admin");
  assert.equal((await realFetch(`${base}/api/members/${owner.id}`, { method: "DELETE", headers: hdr(admin.key) })).status, 409);
});

test("build a deck from a timestamped transcript", async () => {
  const r = await fetch(`${base}/api/decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "News", language: "JP", audioUrl: "/a.mp3", transcript: "[00:00] one\n[00:04] two" }),
  });
  assert.equal(r.status, 201);
  const deck = await j(r);
  assert.equal(deck.cards.length, 2);
  assert.equal(deck.cards[0].start, 0);
  assert.equal(deck.cards[0].end, 4);
  assert.equal(deck.cardCount ?? deck.cards.length, 2);
});

test("decks list reflects due counts; due endpoint returns fresh cards", async () => {
  const list = await fetch(`${base}/api/decks`).then(j);
  assert.ok(list.length >= 1);
  const id = list[0].id;
  const due = await fetch(`${base}/api/decks/${id}/due`).then(j);
  assert.ok(due.length >= 1, "fresh cards are due immediately");
});

test("review moves a card out of the due queue", async () => {
  const list = await fetch(`${base}/api/decks`).then(j);
  const id = list[0].id;
  const due = await fetch(`${base}/api/decks/${id}/due`).then(j);
  const card = due[0];
  const r = await fetch(`${base}/api/cards/${card.id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grade: "good" }),
  });
  assert.equal(r.status, 200);
  const updated = await j(r);
  assert.equal(updated.srs.reps, 1);
  assert.ok(updated.srs.due > Date.now());

  const dueAfter = await fetch(`${base}/api/decks/${id}/due`).then(j);
  assert.ok(!dueAfter.find((c) => c.id === card.id), "reviewed card no longer due");
});

test("patch a card's back text persists", async () => {
  const list = await fetch(`${base}/api/decks`).then(j);
  const deck = await fetch(`${base}/api/decks/${list[0].id}`).then(j);
  const card = deck.cards[0];
  const r = await fetch(`${base}/api/cards/${card.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ back: "translation" }),
  });
  assert.equal((await j(r)).back, "translation");
  const reread = await fetch(`${base}/api/decks/${list[0].id}`).then(j);
  assert.equal(reread.cards[0].back, "translation");
});

test("export returns anki tsv with attachment headers", async () => {
  const list = await fetch(`${base}/api/decks`).then(j);
  const r = await fetch(`${base}/api/decks/${list[0].id}/export?format=anki`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /tab-separated-values/);
  assert.match(r.headers.get("content-disposition"), /\.tsv/);
  const body = await r.text();
  assert.ok(body.includes("\t"));
});

test("invalid grade is rejected; unknown ids 404", async () => {
  const list = await fetch(`${base}/api/decks`).then(j);
  const deck = await fetch(`${base}/api/decks/${list[0].id}`).then(j);
  const bad = await fetch(`${base}/api/cards/${deck.cards[0].id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grade: "nope" }),
  });
  assert.equal(bad.status, 400);
  assert.equal((await fetch(`${base}/api/decks/missing`)).status, 404);
});

test("alerts summary counts due cards and clears them after review", async () => {
  const before = await fetch(`${base}/api/alerts`).then(j);

  const deck = await fetch(`${base}/api/decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Alert deck", transcript: "[00:00] a\n[00:04] b" }),
  }).then(j);

  const after = await fetch(`${base}/api/alerts`).then(j);
  assert.equal(after.totalDue, before.totalDue + 2, "two fresh cards become due");
  const entry = after.decksDue.find((d) => d.id === deck.id);
  assert.ok(entry && entry.dueCount === 2);
  // decksDue is sorted by dueCount descending.
  for (let i = 1; i < after.decksDue.length; i++) {
    assert.ok(after.decksDue[i - 1].dueCount >= after.decksDue[i].dueCount);
  }

  for (const card of deck.cards) {
    await fetch(`${base}/api/cards/${card.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade: "good" }),
    });
  }

  const done = await fetch(`${base}/api/alerts`).then(j);
  assert.equal(done.totalDue, before.totalDue, "reviewed cards leave the due total");
  assert.ok(!done.decksDue.find((d) => d.id === deck.id), "deck no longer in alert list");
  assert.ok(done.nextDue > Date.now(), "next-due time points to the scheduled cards");
});

test("reminder preview reflects due cards; test endpoint force-sends", async () => {
  // At this point earlier tests have left some due cards in the store.
  const preview = await fetch(`${base}/api/reminders/preview`).then(j);
  assert.equal(preview.enabled, true);
  assert.ok(preview.message, "a reminder message is pending");
  assert.match(preview.message.title, /ready to review/);

  const countBefore = sentReminders.length;
  const sent = await fetch(`${base}/api/reminders/test`, { method: "POST" }).then(j);
  assert.equal(sent.sent, true);
  assert.equal(sentReminders.length, countBefore + 1);
  assert.match(sentReminders.at(-1).title, /EchoDeck/);
});

test("search finds cards by front/back across decks, with deck context", async () => {
  const deck = await fetch(`${base}/api/decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Search deck", language: "Japanese", transcript: "[00:00] konnichiwa world\n[00:04] sayonara" }),
  }).then(j);
  const full = await fetch(`${base}/api/decks/${deck.id}`).then(j);
  await fetch(`${base}/api/cards/${full.cards[1].id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ back: "goodbye world" }),
  });

  // Match on front.
  const front = await fetch(`${base}/api/search?q=konnichiwa`).then(j);
  assert.ok(front.length >= 1);
  assert.equal(front[0].field, "front");
  assert.equal(front[0].deckTitle, "Search deck");
  assert.ok("cardId" in front[0] && "deckId" in front[0]);

  // Match on back, case-insensitive.
  const back = await fetch(`${base}/api/search?q=GOODBYE`).then(j);
  assert.ok(back.find((r) => r.field === "back" && r.cardId === full.cards[1].id));

  // Empty query returns nothing; limit is honoured.
  assert.deepEqual(await fetch(`${base}/api/search?q=`).then(j), []);
  const limited = await fetch(`${base}/api/search?q=world&limit=1`).then(j);
  assert.equal(limited.length, 1);
});

test("cloze generation fills blanks and is idempotent without overwrite", async () => {
  const deck = await fetch(`${base}/api/decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Cloze deck", language: "Japanese", transcript: "[00:00] 今日は天気がいいです\n[00:04] 週末は雨が降ります" }),
  }).then(j);

  const gen = await fetch(`${base}/api/decks/${deck.id}/cloze`, { method: "POST" }).then(j);
  assert.equal(gen.updated, 2);
  assert.ok(gen.deck.cards.every((c) => c.cloze && c.front.includes(c.cloze)), "each cloze term occurs in its sentence");

  // Second run with no overwrite changes nothing.
  const again = await fetch(`${base}/api/decks/${deck.id}/cloze`, { method: "POST" }).then(j);
  assert.equal(again.updated, 0);

  // A manual cloze survives PATCH and can be cleared with null.
  const cardId = gen.deck.cards[0].id;
  const set = await fetch(`${base}/api/cards/${cardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cloze: "今日" }),
  }).then(j);
  assert.equal(set.cloze, "今日");
  const cleared = await fetch(`${base}/api/cards/${cardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cloze: null }),
  }).then(j);
  assert.equal(cleared.cloze, null);
});

test("stats endpoint reflects review activity", async () => {
  // Earlier tests reviewed at least one card, so today's activity is non-zero.
  const s = await fetch(`${base}/api/stats`).then(j);
  assert.equal(s.daily.length, 14);
  assert.equal(s.forecast.length, 7);
  assert.ok(s.totalReviews >= 1, "reviews were logged");
  assert.ok(s.reviewedToday >= 1, "today's reviews counted");
  assert.ok(s.totalCards >= 1);
  assert.ok(s.retentionRate === null || (s.retentionRate >= 0 && s.retentionRate <= 100));
});

test("sharing exposes a read-only public deck and revokes on unshare", async () => {
  const deck = await fetch(`${base}/api/decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Shared JP", language: "Japanese", audioUrl: "/a.mp3", transcript: "[00:00] one\n[00:04] two" }),
  }).then(j);

  // Publish.
  const pub = await fetch(`${base}/api/decks/${deck.id}/share`, { method: "POST" }).then(j);
  assert.ok(pub.shareId && pub.shareId.length >= 16);
  assert.match(pub.shareUrl, new RegExp(`/s/${pub.shareId}$`));

  // Re-publishing returns the same id (idempotent).
  const pub2 = await fetch(`${base}/api/decks/${deck.id}/share`, { method: "POST" }).then(j);
  assert.equal(pub2.shareId, pub.shareId);

  // Public view: card content only, no SRS state, with a working viewer page.
  const shared = await fetch(`${base}/api/shared/${pub.shareId}`).then(j);
  assert.equal(shared.title, "Shared JP");
  assert.equal(shared.cards.length, 2);
  assert.equal(shared.cards[0].front, "one");
  assert.ok(!("srs" in shared.cards[0]), "private scheduling state is not exposed");
  assert.ok(!("id" in shared.cards[0]));

  const page = await fetch(`${base}/s/${pub.shareId}`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /html/);

  // Public export works.
  const exp = await fetch(`${base}/api/shared/${pub.shareId}/export?format=anki`);
  assert.equal(exp.status, 200);
  assert.ok((await exp.text()).includes("\t"));

  // Unshare revokes access.
  assert.equal((await fetch(`${base}/api/decks/${deck.id}/share`, { method: "DELETE" })).status, 204);
  assert.equal((await fetch(`${base}/api/shared/${pub.shareId}`)).status, 404);
});

test("deleting a deck removes it and its cards", async () => {
  const created = await fetch(`${base}/api/decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Temp", transcript: "alpha. beta." }),
  }).then(j);
  assert.equal((await fetch(`${base}/api/decks/${created.id}`, { method: "DELETE" })).status, 204);
  assert.equal((await fetch(`${base}/api/decks/${created.id}`)).status, 404);
});

test("marketplace: list a deck, browse the public catalog, and install it", async () => {
  // Build a deck in the suite's (Team-plan) workspace and list it.
  const deck = await fetch(`${base}/api/decks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "JLPT N5 core", language: "Japanese", transcript: "[00:00] ねこ\n[00:02] いぬ" }),
  }).then(j);
  const listed = await fetch(`${base}/api/decks/${deck.id}/list`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: "Beginner vocabulary from NHK Easy." }),
  }).then(j);
  assert.ok(listed.shareId);
  assert.equal(listed.listed, true);
  assert.match(listed.shareUrl, /\/s\//);

  // The catalog is public — no workspace key required.
  const catalog = await realFetch(`${base}/api/marketplace`).then(j);
  const entry = catalog.find((e) => e.shareId === listed.shareId);
  assert.ok(entry, "listed deck shows in the public catalog");
  assert.equal(entry.cardCount, 2);
  assert.equal(entry.description, "Beginner vocabulary from NHK Easy.");
  assert.equal(entry.installs, 0);

  // Text query and language filter both work.
  assert.ok((await realFetch(`${base}/api/marketplace?q=nhk`).then(j)).some((e) => e.shareId === listed.shareId));
  assert.ok((await realFetch(`${base}/api/marketplace?language=Japanese`).then(j)).some((e) => e.shareId === listed.shareId));
  assert.ok(!(await realFetch(`${base}/api/marketplace?q=zzznotfound`).then(j)).some((e) => e.shareId === listed.shareId));

  // A separate workspace installs the listing into its own space.
  const other = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Learner" }),
  }).then(j);
  const auth = { Authorization: `Bearer ${other.key}`, "Content-Type": "application/json" };
  const installed = await realFetch(`${base}/api/marketplace/${listed.shareId}/install`, { method: "POST", headers: auth }).then(j);
  assert.equal(installed.cardCount, 2);
  assert.ok(installed.deckId);

  // The clone lives in the learner's workspace with fresh, due cards.
  const clone = await realFetch(`${base}/api/decks/${installed.deckId}`, { headers: { Authorization: `Bearer ${other.key}` } }).then(j);
  assert.equal(clone.title, "JLPT N5 core");
  assert.equal(clone.cards.length, 2);
  assert.notEqual(clone.id, deck.id);
  assert.equal(clone.listed, false);
  assert.equal(clone.shareId, null);

  // Install count bumped on the source listing.
  assert.equal((await realFetch(`${base}/api/marketplace`).then(j)).find((e) => e.shareId === listed.shareId).installs, 1);

  // Unlisting removes it from the catalog (but keeps the share link live).
  assert.equal((await fetch(`${base}/api/decks/${deck.id}/list`, { method: "DELETE" })).status, 204);
  assert.ok(!(await realFetch(`${base}/api/marketplace`).then(j)).some((e) => e.shareId === listed.shareId));
  assert.equal((await realFetch(`${base}/api/marketplace/${listed.shareId}/install`, { method: "POST", headers: auth })).status, 404);
  assert.equal((await fetch(`${base}/api/shared/${listed.shareId}`)).status, 200); // still shared
});

test("marketplace: listing is gated on Free; install respects plan limits", async () => {
  const hdr = (key, json) => ({ Authorization: `Bearer ${key}`, ...(json ? { "Content-Type": "application/json" } : {}) });
  // A Free workspace cannot list a deck (402, same gate as sharing).
  const free = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Free lister" }),
  }).then(j);
  const fdeck = await realFetch(`${base}/api/decks`, {
    method: "POST", headers: hdr(free.key, true), body: JSON.stringify({ title: "x", transcript: "[00:00] a" }),
  }).then(j);
  assert.equal((await realFetch(`${base}/api/decks/${fdeck.id}/list`, { method: "POST", headers: hdr(free.key, true), body: "{}" })).status, 402);

  // Publish a big listing from the Team workspace.
  const big = await fetch(`${base}/api/decks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Big", transcript: Array.from({ length: 60 }, (_, i) => `[00:0${i % 10}] line ${i}`).join("\n") }),
  }).then(j);
  const bigListed = await fetch(`${base}/api/decks/${big.id}/list`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  }).then(j);

  // The Free workspace already has 1 deck; installing 60 cards would exceed the
  // 100-card cap only if combined — but the deck cap (3) or card cap applies.
  // Fill it to the card limit first, then the install is blocked with 402.
  await realFetch(`${base}/api/decks/${fdeck.id}/cards`, {
    method: "POST", headers: hdr(free.key, true),
    body: JSON.stringify({ transcript: Array.from({ length: 60 }, (_, i) => `[00:0${i % 10}] fill ${i}`).join("\n") }),
  });
  const blocked = await realFetch(`${base}/api/marketplace/${bigListed.shareId}/install`, { method: "POST", headers: hdr(free.key, true) });
  assert.equal(blocked.status, 402);
  assert.equal((await blocked.json()).upgrade, true);
});

test("pronounce: scores a shadowing attempt and can apply the grade to the SRS", async () => {
  const deck = await fetch(`${base}/api/decks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Shadowing", transcript: "the quick brown fox" }),
  }).then(j);
  const cardId = deck.cards[0].id;

  // A perfect attempt scores 100 and suggests "easy" without touching the SRS.
  const perfect = await fetch(`${base}/api/cards/${cardId}/pronounce`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ heard: "The quick brown fox!" }),
  }).then(j);
  assert.equal(perfect.score, 100);
  assert.equal(perfect.suggestedGrade, "easy");
  assert.equal(perfect.applied, false);
  assert.equal(perfect.card, null);

  // A partial attempt with applyGrade reviews the card (SRS advances).
  const before = await fetch(`${base}/api/decks/${deck.id}`).then(j);
  const repsBefore = before.cards[0].srs.reps;
  const partial = await fetch(`${base}/api/cards/${cardId}/pronounce`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ heard: "the brown dog", applyGrade: true }),
  }).then(j);
  assert.equal(partial.score, 50);
  assert.deepEqual(partial.missed, ["quick", "fox"]);
  assert.equal(partial.applied, true);
  assert.ok(partial.card, "returns the updated card");
  assert.equal(partial.card.srs.reps, repsBefore + 1);

  // Unknown card → 404; empty attempt scores 0.
  assert.equal((await fetch(`${base}/api/cards/nope/pronounce`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ heard: "x" }),
  })).status, 404);
  const empty = await fetch(`${base}/api/cards/${cardId}/pronounce`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ heard: "" }),
  }).then(j);
  assert.equal(empty.score, 0);
});

test("AI fill: enrich a single card and bulk-fill a deck's empty backs", async () => {
  const deck = await fetch(`${base}/api/decks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Enrich me", language: "Japanese", transcript: "[00:00] ねこ\n[00:02] いぬ\n[00:04] とり" }),
  }).then(j);

  // The workspace endpoint advertises that AI fill is configured.
  assert.equal((await fetch(`${base}/api/workspace`).then(j)).enrichConfigured, true);

  // Single-card enrich fills back + notes from the fake generator.
  const first = deck.cards[0];
  const enriched = await fetch(`${base}/api/cards/${first.id}/enrich`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  }).then(j);
  assert.equal(enriched.generated.back, "EN:ねこ");
  assert.equal(enriched.card.back, "EN:ねこ");
  assert.equal(enriched.card.notes, "note(Japanese)");

  // Without overwrite, an existing back is preserved.
  await fetch(`${base}/api/cards/${deck.cards[1].id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ back: "kept" }),
  });

  // Bulk enrich fills only the cards still missing a back (card 0 already has one,
  // card 1 was set manually) → only card 2 is filled.
  const bulk = await fetch(`${base}/api/decks/${deck.id}/enrich`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  }).then(j);
  assert.equal(bulk.updated, 1);
  const byFront = Object.fromEntries(bulk.deck.cards.map((c) => [c.front, c.back]));
  assert.equal(byFront["いぬ"], "kept");
  assert.equal(byFront["とり"], "EN:とり");

  // Unknown card → 404.
  assert.equal((await fetch(`${base}/api/cards/nope/enrich`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  })).status, 404);
});

test("AI fill is gated on the Free plan", async () => {
  const hdr = (key, json) => ({ Authorization: `Bearer ${key}`, ...(json ? { "Content-Type": "application/json" } : {}) });
  const free = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Free AI" }),
  }).then(j);
  const deck = await realFetch(`${base}/api/decks`, {
    method: "POST", headers: hdr(free.key, true), body: JSON.stringify({ title: "x", transcript: "[00:00] a" }),
  }).then(j);
  assert.equal((await realFetch(`${base}/api/cards/${deck.cards[0].id}/enrich`, {
    method: "POST", headers: hdr(free.key, true), body: "{}",
  })).status, 402);
});

test("auto-transcription: audio URL becomes timestamped transcript, then builds a deck", async () => {
  // The workspace endpoint advertises that transcription is configured.
  assert.equal((await fetch(`${base}/api/workspace`).then(j)).transcribeConfigured, true);

  // Transcribe an audio URL → bracket-timestamped lines from the fake provider.
  const res = await fetch(`${base}/api/transcribe`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioUrl: "http://example/clip.mp3" }),
  }).then(j);
  assert.match(res.transcript, /^\[00:00\] heard from http:\/\/example\/clip\.mp3\n\[00:03\] second line$/);
  assert.equal(res.segments.length, 2);

  // The transcript drops straight into the normal build pipeline → timestamped cards.
  const deck = await fetch(`${base}/api/decks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "From audio", audioUrl: "http://example/clip.mp3", transcript: res.transcript }),
  }).then(j);
  assert.equal(deck.cards.length, 2);
  assert.equal(deck.cards[0].start, 0);
  assert.equal(deck.cards[1].start, 3);

  // Missing URL → 400.
  assert.equal((await fetch(`${base}/api/transcribe`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  })).status, 400);
});

test("SEO: shared deck page has per-deck meta; sitemap lists only listed decks", async () => {
  const deck = await fetch(`${base}/api/decks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "SEO Deck <Japanese>", language: "Japanese", transcript: "[00:00] ねこ\n[00:02] いぬ" }),
  }).then(j);

  // Listing publishes + marks it discoverable.
  const listed = await fetch(`${base}/api/decks/${deck.id}/list`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  }).then(j);

  // The public viewer carries server-rendered, escaped, per-deck meta.
  const html = await (await fetch(`${base}/s/${listed.shareId}`)).text();
  assert.match(html, /<title>SEO Deck &lt;Japanese&gt; — Japanese flashcards &amp; shadowing · EchoDeck<\/title>/);
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, new RegExp(`<link rel="canonical" href="[^"]*/s/${listed.shareId}"`));
  assert.match(html, /2 Japanese flashcards/);

  // robots.txt points at the sitemap; sitemap enumerates the listed deck + /marketplace.
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  assert.match(robots, /Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/);
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  assert.match(sitemap, /\/marketplace</);
  assert.ok(sitemap.includes(`/s/${listed.shareId}<`), "listed deck appears in sitemap");

  // A shared-but-unlisted deck must NOT leak into the sitemap.
  const priv = await fetch(`${base}/api/decks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Private", transcript: "[00:00] x" }),
  }).then(j);
  const pub = await fetch(`${base}/api/decks/${priv.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(j);
  const sitemap2 = await (await fetch(`${base}/sitemap.xml`)).text();
  assert.ok(!sitemap2.includes(`/s/${pub.shareId}<`), "unlisted share link stays out of the sitemap");
  // …but the unlisted deck is still viewable and gets meta.
  assert.equal((await fetch(`${base}/s/${pub.shareId}`)).status, 200);
});

test("SEO: unknown shared deck still returns a valid page with a default title", async () => {
  const html = await (await fetch(`${base}/s/does-not-exist`)).text();
  assert.match(html, /<title>Shared deck — EchoDeck<\/title>/);
});

test("creator analytics: views and installs roll up per shared deck", async () => {
  const deck = await fetch(`${base}/api/decks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Reach", language: "Spanish", transcript: "[00:00] uno\n[00:02] dos" }),
  }).then(j);
  const listed = await fetch(`${base}/api/decks/${deck.id}/list`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  }).then(j);

  // Two public views (no auth) — the wrapper doesn't touch /api/shared.
  await fetch(`${base}/api/shared/${listed.shareId}`);
  await fetch(`${base}/api/shared/${listed.shareId}`);

  // One install from another workspace.
  const other = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Installer" }),
  }).then(j);
  await realFetch(`${base}/api/marketplace/${listed.shareId}/install`, { method: "POST", headers: { Authorization: `Bearer ${other.key}` } });

  const stats = await fetch(`${base}/api/creator/stats`).then(j);
  const entry = stats.decks.find((d) => d.deckId === deck.id);
  assert.ok(entry, "shared deck appears in creator stats");
  assert.equal(entry.views, 2);
  assert.equal(entry.installs, 1);
  assert.equal(entry.listed, true);
  assert.ok(stats.totalViews >= 2 && stats.totalInstalls >= 1 && stats.sharedCount >= 1);

  // Exporting a shared deck must NOT count as a view.
  await fetch(`${base}/api/shared/${listed.shareId}/export?format=csv`);
  const after = await fetch(`${base}/api/creator/stats`).then(j);
  assert.equal(after.decks.find((d) => d.deckId === deck.id).views, 2);
});

test("creator analytics is gated on the Free plan", async () => {
  const free = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Free reach" }),
  }).then(j);
  assert.equal((await realFetch(`${base}/api/creator/stats`, { headers: { Authorization: `Bearer ${free.key}` } })).status, 402);
});

test("web push: config, subscribe, test delivery, and unsubscribe", async () => {
  const cfg = await fetch(`${base}/api/push/config`).then(j);
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.publicKey, "test-vapid-key");

  // A bad subscription is rejected; a valid one is stored.
  assert.equal((await fetch(`${base}/api/push/subscribe`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  })).status, 400);
  const sub = { endpoint: "https://push.example/dev-1", keys: { p256dh: "x", auth: "y" } };
  assert.equal((await fetch(`${base}/api/push/subscribe`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub }),
  })).status, 201);

  // Ensure something is due, then a test push reaches the subscribed device.
  await fetch(`${base}/api/decks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Due now", transcript: "alpha. beta." }),
  });
  sentPush.length = 0;
  const r = await fetch(`${base}/api/push/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(j);
  assert.equal(r.pushed, 1);
  assert.equal(sentPush.length, 1);
  assert.match(JSON.parse(sentPush[0].payload).title, /EchoDeck/);

  // Unsubscribing stops delivery.
  assert.equal((await fetch(`${base}/api/push/unsubscribe`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }),
  })).status, 204);
  sentPush.length = 0;
  const r2 = await fetch(`${base}/api/push/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(j);
  assert.equal(r2.pushed, 0);
  assert.equal(sentPush.length, 0);
});

test("push test is gated on the Free plan; subscriptions are workspace-scoped", async () => {
  const free = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Free push" }),
  }).then(j);
  const hdr = { Authorization: `Bearer ${free.key}`, "Content-Type": "application/json" };
  // Free can still subscribe a device...
  assert.equal((await realFetch(`${base}/api/push/subscribe`, { method: "POST", headers: hdr, body: JSON.stringify({ subscription: { endpoint: "https://push.example/free-1" } }) })).status, 201);
  // ...but the test-send (like reminders) is a paid feature.
  assert.equal((await realFetch(`${base}/api/push/test`, { method: "POST", headers: hdr, body: "{}" })).status, 402);
});

// --- no-signup demo --------------------------------------------------------

test("demo build works without any workspace key and never persists", async () => {
  // realFetch = no auto-injected Authorization header, proving it's public.
  const r = await realFetch(`${base}/api/demo/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript: "[00:00] Hola mundo bonito.\n[00:04] Buenos dias a todos." }),
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.segments.length, 2);
  // Timestamps are parsed through the real segmenter.
  assert.equal(data.segments[0].start, 0);
  // A cloze blank is suggested for a spaced sentence (longest word masked).
  assert.ok(data.segments[0].cloze);
  assert.match(data.segments[0].cloze.masked, /＿＿＿/);
  assert.ok(data.segments[0].text.includes(data.segments[0].cloze.answer));
});

test("demo build caps the number of returned cards and reports truncation", async () => {
  const lines = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} here.`).join(" ");
  const data = await realFetch(`${base}/api/demo/build`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript: lines, maxChars: 30 }),
  }).then(j);
  assert.equal(data.segments.length, 12);
  assert.ok(data.total > 12);
  assert.equal(data.truncated, true);
});

test("demo build rejects empty and oversized input", async () => {
  const empty = await realFetch(`${base}/api/demo/build`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: "   " }),
  });
  assert.equal(empty.status, 400);
  const huge = await realFetch(`${base}/api/demo/build`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: "x".repeat(20001) }),
  });
  assert.equal(huge.status, 413);
});

test("demo score returns word-level accuracy without a card or key", async () => {
  const data = await realFetch(`${base}/api/demo/score`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: "the quick brown fox", heard: "the quick fox" }),
  }).then(j);
  assert.equal(data.total, 4);
  assert.equal(data.matched, 3);
  assert.equal(data.score, 75);
  assert.ok(["again", "hard", "good", "easy"].includes(data.suggestedGrade));
  const missing = await realFetch(`${base}/api/demo/score`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ heard: "x" }),
  });
  assert.equal(missing.status, 400);
});

test("/demo page is served", async () => {
  const r = await realFetch(`${base}/demo`);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /no signup/i);
  assert.match(html, /demo\.js/);
});

test("sitemap includes the demo page", async () => {
  const xml = await realFetch(`${base}/sitemap.xml`).then((r) => r.text());
  assert.match(xml, /\/demo</);
});

// --- URL / YouTube import --------------------------------------------------

test("import returns a transcript + segments the build form can use", async () => {
  const r = await fetch(`${base}/api/import`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.source, "youtube");
  assert.equal(data.videoId, "dQw4w9WgXcQ"); // client uses this to attach the video
  assert.deepEqual(data.availableLangs, ["es", "en"]); // drives the language chips
  assert.equal(data.title, "Imported");
  assert.equal(data.language, "es");
  assert.equal(data.segmentCount, 2);
  assert.equal(data.segments[0].start, 0);
  // The imported transcript builds a real deck through the normal endpoint,
  // with the youtube: audio reference stored for embedded playback.
  const deck = await fetch(`${base}/api/decks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: data.title, language: data.language, transcript: data.transcript, audioUrl: `youtube:${data.videoId}` }),
  }).then(j);
  assert.equal(deck.cards.length, 2);
  assert.equal(deck.audioUrl, "youtube:dQw4w9WgXcQ");
});

test("import surfaces a friendly error and requires a URL", async () => {
  const noUrl = await fetch(`${base}/api/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(noUrl.status, 400);
  const bad = await fetch(`${base}/api/import`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://youtu.be/bad00000000" }),
  });
  assert.equal(bad.status, 422);
  assert.match((await bad.json()).error, /captions/);
});

test("import requires a workspace key", async () => {
  const r = await realFetch(`${base}/api/import`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
  });
  assert.equal(r.status, 401);
});

// --- annual billing --------------------------------------------------------

test("/api/plans exposes annual pricing for paid tiers", async () => {
  const plans = await fetch(`${base}/api/plans`).then(j);
  const pro = plans.find((p) => p.id === "pro");
  assert.equal(pro.priceYear, 79);
  assert.ok(pro.yearSavingPct > 0);
  assert.equal(plans.find((p) => p.id === "free").priceYear, null);
});

test("checkout accepts an annual interval (dev mode applies immediately)", async () => {
  const ws = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Annual" }),
  }).then(j);
  const hdr = { Authorization: `Bearer ${ws.key}`, "Content-Type": "application/json" };
  const r = await realFetch(`${base}/api/billing/checkout`, {
    method: "POST", headers: hdr, body: JSON.stringify({ plan: "pro", interval: "year" }),
  }).then(j);
  assert.equal(r.dev, true);
  assert.equal((await realFetch(`${base}/api/workspace`, { headers: hdr }).then(j)).plan, "pro");
});

// --- email invitations -----------------------------------------------------

test("inviting a member with an email sends a join link carrying their key", async () => {
  // A Team workspace (members are a Team feature).
  const ws = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Invite Team" }),
  }).then(j);
  // Upgrade to Team (dev-mode checkout applies immediately) so member adds are allowed.
  const hdr = { Authorization: `Bearer ${ws.key}`, "Content-Type": "application/json" };
  await realFetch(`${base}/api/billing/checkout`, { method: "POST", headers: hdr, body: JSON.stringify({ plan: "team" }) });

  sentEmails.length = 0;
  const m = await realFetch(`${base}/api/members`, {
    method: "POST", headers: hdr, body: JSON.stringify({ name: "Sam", role: "editor", email: "Sam@Example.com" }),
  }).then(j);
  assert.equal(m.invited, true);
  assert.equal(m.inviteEmail, "sam@example.com"); // normalised
  assert.ok(m.inviteLink.includes(`/app?key=${m.key}`));
  // The email actually went out, to the invitee, containing the join link.
  const mail = sentEmails.find((e) => e.to === "sam@example.com");
  assert.ok(mail, "an email was sent to the invitee");
  assert.match(mail.subject, /invited/i);
  assert.ok(mail.text.includes(m.key));

  // The emailed key really grants access to that workspace.
  const check = await realFetch(`${base}/api/workspace`, { headers: { Authorization: `Bearer ${m.key}` } }).then(j);
  assert.equal(check.name, "Invite Team");
});

test("inviting without an email just returns the key (no mail sent)", async () => {
  const ws = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "No Email Team" }),
  }).then(j);
  const hdr = { Authorization: `Bearer ${ws.key}`, "Content-Type": "application/json" };
  await realFetch(`${base}/api/billing/checkout`, { method: "POST", headers: hdr, body: JSON.stringify({ plan: "team" }) });
  sentEmails.length = 0;
  const m = await realFetch(`${base}/api/members`, {
    method: "POST", headers: hdr, body: JSON.stringify({ name: "Pat", role: "viewer" }),
  }).then(j);
  assert.ok(m.key);
  assert.equal(m.invited, undefined);
  assert.equal(m.inviteLink, undefined);
  assert.equal(sentEmails.length, 0);
});

// --- SEO language pages ----------------------------------------------------

test("language landing pages render server-side and 404 unknown slugs", async () => {
  const es = await realFetch(`${base}/learn/spanish`);
  assert.equal(es.status, 200);
  assert.match(es.headers.get("content-type"), /html/);
  const html = await es.text();
  assert.match(html, /Learn Spanish/);
  assert.match(html, /rel="canonical"/);

  const hub = await realFetch(`${base}/learn`);
  assert.equal(hub.status, 200);
  assert.match(await hub.text(), /\/learn\/japanese/);

  // Unknown language falls back to the marketing page with a 404 status.
  const bad = await realFetch(`${base}/learn/klingon`);
  assert.equal(bad.status, 404);
});

test("sitemap lists the language pages", async () => {
  const xml = await realFetch(`${base}/sitemap.xml`).then((r) => r.text());
  assert.match(xml, /\/learn</);
  assert.match(xml, /\/learn\/spanish</);
  assert.match(xml, /\/learn\/korean</);
});

// --- bundled starter decks ---------------------------------------------------

test("starter catalog is public and lists every language pack", async () => {
  const r = await realFetch(`${base}/api/starters`);
  assert.equal(r.status, 200);
  const starters = await r.json();
  assert.ok(starters.length >= 8, "ships with at least 8 starter decks");
  for (const s of starters) {
    assert.ok(s.id && s.title && s.language && s.description);
    assert.ok(s.cardCount >= 8, `${s.id} has a real amount of content`);
    assert.equal(s.starter, true);
    assert.equal(s.cards, undefined, "catalog view must not ship card bodies");
  }
});

test("installing a starter clones it with backs + notes into the workspace", async () => {
  const starters = await fetch(`${base}/api/starters`).then(j);
  const pick = starters.find((s) => s.language === "Spanish");
  const r = await fetch(`${base}/api/starters/${pick.id}/install`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(r.status, 201);
  const res = await r.json();
  assert.equal(res.cards, pick.cardCount);
  const deck = await fetch(`${base}/api/decks/${res.deckId}`).then(j);
  assert.equal(deck.title, pick.title);
  assert.equal(deck.language, "Spanish");
  assert.equal(deck.cards.length, pick.cardCount);
  // Cards arrive ready to study: front, back and a note.
  assert.ok(deck.cards.every((c) => c.front && c.back && c.notes));
  // And they're due for review like any new card.
  const due = await fetch(`${base}/api/decks/${res.deckId}/due`).then(j);
  assert.equal(due.length, pick.cardCount);
});

test("starter install respects plan limits and 404s unknown ids", async () => {
  assert.equal((await fetch(`${base}/api/starters/nope/install`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 404);
  // A Free workspace can install up to its 3-deck limit, then gets a 402.
  const ws = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Starter Free" }),
  }).then(j);
  const hdr = { Authorization: `Bearer ${ws.key}`, "Content-Type": "application/json" };
  const starters = await realFetch(`${base}/api/starters`).then(j);
  for (let i = 0; i < 3; i++) {
    const r = await realFetch(`${base}/api/starters/${starters[i].id}/install`, { method: "POST", headers: hdr, body: "{}" });
    assert.equal(r.status, 201, `install ${i + 1} within the Free limit`);
  }
  const blocked = await realFetch(`${base}/api/starters/${starters[3].id}/install`, { method: "POST", headers: hdr, body: "{}" });
  assert.equal(blocked.status, 402);
  assert.equal((await blocked.json()).upgrade, true);
  // Anonymous callers can't install.
  assert.equal((await realFetch(`${base}/api/starters/${starters[0].id}/install`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
});

// --- admin panel -------------------------------------------------------------

test("admin overview is owner-only and reports totals, plans and usage", async () => {
  // Anonymous and non-owner sessions are rejected.
  assert.equal((await realFetch(`${base}/api/admin/overview`)).status, 403);
  const normie = await realFetch(`${base}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-admin@example.com", password: "password1" }),
  }).then(j);
  assert.equal((await realFetch(`${base}/api/admin/overview`, { headers: { "X-Session": normie.token } })).status, 403);

  // The owner (OWNER_EMAILS, created in the auto-comp test) gets the payload.
  const owner = await realFetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@echodeck.app", password: "passw0rd" }),
  }).then(j);
  const o = await realFetch(`${base}/api/admin/overview`, { headers: { "X-Session": owner.token } }).then(j);
  assert.ok(o.totals.workspaces >= 1);
  assert.ok(o.totals.accounts >= 2);
  assert.ok(o.totals.decks >= 1);
  assert.ok(typeof o.plans === "object");
  assert.ok(Array.isArray(o.recentWorkspaces) && o.recentWorkspaces.length >= 1);
  assert.ok(o.recentWorkspaces[0].name && o.recentWorkspaces[0].plan);
  assert.ok(Array.isArray(o.recentAccounts));
  assert.ok(typeof o.usageToday.aiFills === "number");
  assert.ok(typeof o.usageToday.imports === "number");
  assert.ok(o.planIds.includes("tester")); // hidden tiers ARE grantable from admin

  // The pricing endpoint still hides the tester tier from the public.
  const publicPlans = await realFetch(`${base}/api/plans`).then(j);
  assert.ok(!publicPlans.some((p) => p.id === "tester"));
});

test("admin can grant the tester plan; the workspace gets its entitlements", async () => {
  const owner = await realFetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@echodeck.app", password: "passw0rd" }),
  }).then(j);
  const ws = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Beta Cohort 1" }),
  }).then(j);

  // Bad plan / bad workspace are rejected.
  assert.equal((await realFetch(`${base}/api/admin/workspaces/${ws.id}/plan`, {
    method: "POST", headers: { "X-Session": owner.token, "Content-Type": "application/json" }, body: JSON.stringify({ plan: "gold" }),
  })).status, 400);
  assert.equal((await realFetch(`${base}/api/admin/workspaces/nope/plan`, {
    method: "POST", headers: { "X-Session": owner.token, "Content-Type": "application/json" }, body: JSON.stringify({ plan: "tester" }),
  })).status, 404);

  // Grant tester → features unlock (enrich works), plan reflects everywhere.
  const r = await realFetch(`${base}/api/admin/workspaces/${ws.id}/plan`, {
    method: "POST", headers: { "X-Session": owner.token, "Content-Type": "application/json" }, body: JSON.stringify({ plan: "tester" }),
  }).then(j);
  assert.equal(r.plan, "tester");
  const hdr = { Authorization: `Bearer ${ws.key}`, "Content-Type": "application/json" };
  const info = await realFetch(`${base}/api/workspace`, { headers: hdr }).then(j);
  assert.equal(info.plan, "tester");
  assert.equal(info.planInfo.maxDecks, 20);
  const deck = await realFetch(`${base}/api/decks`, {
    method: "POST", headers: hdr, body: JSON.stringify({ title: "T", transcript: "hola mundo." }),
  }).then(j);
  const fill = await realFetch(`${base}/api/cards/${deck.cards[0].id}/enrich`, { method: "POST", headers: hdr, body: "{}" });
  assert.equal(fill.status, 200); // enrich is unlocked on the tester tier

  // Non-owners cannot change plans.
  assert.equal((await realFetch(`${base}/api/admin/workspaces/${ws.id}/plan`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "team" }),
  })).status, 403);
});

// --- beta invite links -------------------------------------------------------

test("beta invites: owner mints a link; redeeming grants the tester plan once per workspace", async () => {
  const owner = await realFetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@echodeck.app", password: "passw0rd" }),
  }).then(j);
  const oHdr = { "X-Session": owner.token, "Content-Type": "application/json" };

  // Only owners can mint or list invites.
  assert.equal((await realFetch(`${base}/api/admin/invites`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 403);

  const inv = await realFetch(`${base}/api/admin/invites`, {
    method: "POST", headers: oHdr, body: JSON.stringify({ plan: "tester", maxUses: 2, note: "cohort 1" }),
  }).then(j);
  assert.ok(inv.code);
  assert.match(inv.link, /\/app\?beta=/);
  assert.equal(inv.plan, "tester");
  assert.equal(inv.maxUses, 2);

  // A fresh workspace redeems the code → tester plan + entitlements.
  const ws = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Tester Via Link" }),
  }).then(j);
  const hdr = { Authorization: `Bearer ${ws.key}`, "Content-Type": "application/json" };
  const red = await realFetch(`${base}/api/beta/redeem`, { method: "POST", headers: hdr, body: JSON.stringify({ code: inv.code }) }).then(j);
  assert.equal(red.plan, "tester");
  assert.equal(red.planInfo.name, "Beta tester");
  assert.equal((await realFetch(`${base}/api/workspace`, { headers: hdr }).then(j)).plan, "tester");

  // Redeeming again from the same workspace doesn't burn a second use.
  const again = await realFetch(`${base}/api/beta/redeem`, { method: "POST", headers: hdr, body: JSON.stringify({ code: inv.code }) }).then(j);
  assert.equal(again.already, true);
  const listed = (await realFetch(`${base}/api/admin/invites`, { headers: oHdr }).then(j)).find((i) => i.code === inv.code);
  assert.equal(listed.uses, 1);

  // A second workspace uses the last slot; a third gets 410 (exhausted).
  const ws2 = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Tester 2" }),
  }).then(j);
  assert.equal((await realFetch(`${base}/api/beta/redeem`, {
    method: "POST", headers: { Authorization: `Bearer ${ws2.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ code: inv.code }),
  })).status, 200);
  const ws3 = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Tester 3" }),
  }).then(j);
  assert.equal((await realFetch(`${base}/api/beta/redeem`, {
    method: "POST", headers: { Authorization: `Bearer ${ws3.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ code: inv.code }),
  })).status, 410);

  // Junk codes are rejected.
  assert.equal((await realFetch(`${base}/api/beta/redeem`, {
    method: "POST", headers: { Authorization: `Bearer ${ws3.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ code: "nope" }),
  })).status, 404);
});

test("beta invites carry a tester name and can be revoked", async () => {
  const owner = await realFetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@echodeck.app", password: "passw0rd" }),
  }).then(j);
  const oHdr = { "X-Session": owner.token, "Content-Type": "application/json" };

  // The tester name (note) round-trips through create + list.
  const inv = await realFetch(`${base}/api/admin/invites`, {
    method: "POST", headers: oHdr, body: JSON.stringify({ plan: "tester", maxUses: 5, note: "Anna — Reddit" }),
  }).then(j);
  assert.equal(inv.note, "Anna — Reddit");
  const listed = (await realFetch(`${base}/api/admin/invites`, { headers: oHdr }).then(j)).find((i) => i.code === inv.code);
  assert.equal(listed.note, "Anna — Reddit");

  // Only owners can revoke; unknown codes 404.
  assert.equal((await realFetch(`${base}/api/admin/invites/${inv.code}`, { method: "DELETE" })).status, 403);
  assert.equal((await realFetch(`${base}/api/admin/invites/nope`, { method: "DELETE", headers: oHdr })).status, 404);

  // Revoke → gone from the list and the link stops redeeming.
  assert.equal((await realFetch(`${base}/api/admin/invites/${inv.code}`, { method: "DELETE", headers: oHdr })).status, 204);
  const after = await realFetch(`${base}/api/admin/invites`, { headers: oHdr }).then(j);
  assert.ok(!after.some((i) => i.code === inv.code));
  const ws = await realFetch(`${base}/api/workspaces`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Late tester" }),
  }).then(j);
  const dead = await realFetch(`${base}/api/beta/redeem`, {
    method: "POST", headers: { Authorization: `Bearer ${ws.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ code: inv.code }),
  });
  assert.equal(dead.status, 404);
  // The late workspace stays on Free.
  assert.equal((await realFetch(`${base}/api/workspace`, { headers: { Authorization: `Bearer ${ws.key}` } }).then(j)).plan, "free");
});
