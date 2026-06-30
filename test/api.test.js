import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../server/store.js";
import { createApp } from "../server/app.js";

let server, base, tmp;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "echodeck-"));
  const store = createStore(join(tmp, "db.json"));
  const app = createApp({ store, uploadsDir: join(tmp, "uploads") });
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

test("deleting a deck removes it and its cards", async () => {
  const created = await fetch(`${base}/api/decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Temp", transcript: "alpha. beta." }),
  }).then(j);
  assert.equal((await fetch(`${base}/api/decks/${created.id}`, { method: "DELETE" })).status, 204);
  assert.equal((await fetch(`${base}/api/decks/${created.id}`)).status, 404);
});
