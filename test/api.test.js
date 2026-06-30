import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../server/store.js";
import { createApp } from "../server/app.js";
import { createReminderService } from "../server/reminders.js";

let server, base, tmp, sentReminders;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "echodeck-"));
  const store = createStore(join(tmp, "db.json"));
  sentReminders = [];
  const reminders = createReminderService({
    store,
    notify: async (msg) => { sentReminders.push(msg); return { ok: true }; },
    config: { minIntervalMs: 1e9 },
  });
  const app = createApp({ store, uploadsDir: join(tmp, "uploads"), reminders });
  await new Promise((res) => { server = app.listen(0, res); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  rmSync(tmp, { recursive: true, force: true });
});

const j = (r) => r.json();

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
