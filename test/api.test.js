import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../server/store.js";
import { createApp } from "../server/app.js";
import { createReminderService } from "../server/reminders.js";
import { createBilling } from "../server/billing.js";

let server, base, tmp, sentReminders, realFetch, wsKey;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "echodeck-"));
  const store = createStore(join(tmp, "db.json"));
  sentReminders = [];
  const reminders = createReminderService({
    store,
    notify: async (msg) => { sentReminders.push(msg); return { ok: true }; },
    config: { minIntervalMs: 1e9 },
  });
  const billing = createBilling({ store, config: {} }); // dev mode (no Stripe keys)
  const ownerEmails = new Set(["owner@echodeck.app"]);
  const app = createApp({ store, uploadsDir: join(tmp, "uploads"), reminders, billing, ownerEmails });
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

test("landing page is served at / and the app at /app", async () => {
  const landing = await realFetch(`${base}/`);
  assert.equal(landing.status, 200);
  const lhtml = await landing.text();
  assert.match(lhtml, /Start free/);
  assert.match(lhtml, /turn native audio/i);

  const app = await realFetch(`${base}/app`);
  assert.equal(app.status, 200);
  assert.match(await app.text(), /id="build-form"/);
});

test("plans catalog is public", async () => {
  const plans = await realFetch(`${base}/api/plans`).then(j);
  assert.deepEqual(plans.map((p) => p.id), ["free", "pro", "team"]);
  assert.equal(plans.find((p) => p.id === "pro").features.sharing, true);
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
