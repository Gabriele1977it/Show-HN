import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../server/store.js";
import { createApp } from "../server/app.js";
import { createEnricher } from "../server/enrich.js";

// The per-workspace daily AI-fill cap is the operator's cost backstop: however
// enthusiastic (or abusive) a workspace is, its Anthropic spend is bounded.

test("AI fills stop with 429 once the daily per-workspace limit is reached", async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), "echodeck-quota-"));
  const store = createStore(join(tmp, "db.json"));
  const enrich = createEnricher({ generate: async (front) => ({ back: `EN:${front}`, notes: "n" }) });
  const app = createApp({ store, uploadsDir: join(tmp, "up"), enrich, aiLimits: { perWorkspacePerDay: 3 } });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.close(); rmSync(tmp, { recursive: true, force: true }); });

  const ws = store.createWorkspace({ name: "Quota WS" });
  store.setWorkspacePlan(ws.id, "pro"); // enrich is a paid feature
  const hdr = { Authorization: `Bearer ${ws.key}`, "Content-Type": "application/json" };
  const deck = await (await fetch(`${base}/api/decks`, {
    method: "POST", headers: hdr,
    body: JSON.stringify({ title: "Q", transcript: "uno. dos. tres. cuatro. cinco.", maxChars: 8 }),
  })).json();
  assert.ok(deck.cards.length >= 4);

  // Three singles pass, the fourth hits the cap.
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${base}/api/cards/${deck.cards[i].id}/enrich`, { method: "POST", headers: hdr, body: "{}" });
    assert.equal(r.status, 200, `fill ${i + 1} should be allowed`);
  }
  const blocked = await fetch(`${base}/api/cards/${deck.cards[3].id}/enrich`, { method: "POST", headers: hdr, body: "{}" });
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /limit/i);

  // Bulk enrich is also blocked when it would exceed the remaining quota.
  const bulk = await fetch(`${base}/api/decks/${deck.id}/enrich`, { method: "POST", headers: hdr, body: "{}" });
  assert.equal(bulk.status, 429);
  assert.match((await bulk.json()).error, /limit/i);

  // Another workspace has its own budget — the cap is per workspace.
  const ws2 = store.createWorkspace({ name: "Other WS" });
  store.setWorkspacePlan(ws2.id, "pro");
  const hdr2 = { Authorization: `Bearer ${ws2.key}`, "Content-Type": "application/json" };
  const deck2 = await (await fetch(`${base}/api/decks`, {
    method: "POST", headers: hdr2, body: JSON.stringify({ title: "Q2", transcript: "hola." }),
  })).json();
  const ok = await fetch(`${base}/api/cards/${deck2.cards[0].id}/enrich`, { method: "POST", headers: hdr2, body: "{}" });
  assert.equal(ok.status, 200);
});

test("bulk enrich consumes quota per card, not per request", async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), "echodeck-quota2-"));
  const store = createStore(join(tmp, "db.json"));
  const enrich = createEnricher({ generate: async (front) => ({ back: `EN:${front}`, notes: "n" }) });
  const app = createApp({ store, uploadsDir: join(tmp, "up"), enrich, aiLimits: { perWorkspacePerDay: 5 } });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.close(); rmSync(tmp, { recursive: true, force: true }); });

  const ws = store.createWorkspace({ name: "Bulk WS" });
  store.setWorkspacePlan(ws.id, "pro");
  const hdr = { Authorization: `Bearer ${ws.key}`, "Content-Type": "application/json" };
  const deck = await (await fetch(`${base}/api/decks`, {
    method: "POST", headers: hdr,
    body: JSON.stringify({ title: "B", transcript: "uno. dos. tres.", maxChars: 6 }),
  })).json();
  assert.equal(deck.cards.length, 3);

  // Bulk fill of 3 empty backs consumes 3 of the 5-fill budget…
  const bulk = await (await fetch(`${base}/api/decks/${deck.id}/enrich`, { method: "POST", headers: hdr, body: "{}" })).json();
  assert.equal(bulk.updated, 3);
  // …so only 2 singles remain before the cap bites.
  await fetch(`${base}/api/cards/${deck.cards[0].id}/enrich`, { method: "POST", headers: hdr, body: JSON.stringify({ overwrite: true }) });
  await fetch(`${base}/api/cards/${deck.cards[1].id}/enrich`, { method: "POST", headers: hdr, body: JSON.stringify({ overwrite: true }) });
  const blocked = await fetch(`${base}/api/cards/${deck.cards[2].id}/enrich`, { method: "POST", headers: hdr, body: JSON.stringify({ overwrite: true }) });
  assert.equal(blocked.status, 429);
});
