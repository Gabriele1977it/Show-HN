// Tiny persistent store.
//
// EchoDeck's data set is small, so a single JSON document with atomic writes is
// plenty. Data is multi-tenant: every deck (and every review event) belongs to
// a workspace, and all read/write paths are scoped by the caller's workspace id
// so teams never see each other's decks. Public share links are the one
// deliberate exception — they resolve globally by an unguessable share id.

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { nanoid } from "nanoid";
import { freshSrs, review, isDue } from "./srs.js";
import { computeStats } from "./stats.js";
import { suggestCloze } from "./cloze.js";

const EMPTY = { workspaces: {}, decks: {}, cards: {}, reviewLog: [] };

// Cap the review log so the JSON document stays small. The stats dashboard only
// looks back a couple of weeks, so older raw events can be dropped safely.
const MAX_LOG = 5000;

export function createStore(filePath) {
  let state = load(filePath);

  function persist() {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = filePath + ".tmp";
    writeFileSync(tmp, JSON.stringify(state, null, 2));
    renameSync(tmp, filePath); // atomic on the same filesystem
  }

  // Ownership guards: return the entity only when it belongs to `ws`.
  const deckOwned = (id, ws) => {
    const d = state.decks[id];
    return d && d.workspaceId === ws ? d : null;
  };
  const cardOwned = (id, ws) => {
    const c = state.cards[id];
    if (!c) return null;
    const d = state.decks[c.deckId];
    return d && d.workspaceId === ws ? c : null;
  };
  const decksOf = (ws) => Object.values(state.decks).filter((d) => d.workspaceId === ws);

  const api = {
    // --- workspaces ----------------------------------------------------
    createWorkspace({ name } = {}) {
      const id = nanoid(10);
      const ws = { id, name: name?.trim() || "My workspace", key: nanoid(24), createdAt: Date.now() };
      state.workspaces[id] = ws;
      persist();
      return ws;
    },

    getWorkspaceByKey(key) {
      if (!key) return null;
      return Object.values(state.workspaces).find((w) => w.key === key) ?? null;
    },

    // Public-safe workspace info (no key).
    getWorkspace(id) {
      const w = state.workspaces[id];
      return w ? { id: w.id, name: w.name, createdAt: w.createdAt } : null;
    },

    listWorkspaceIds() {
      return Object.keys(state.workspaces);
    },

    // --- decks ---------------------------------------------------------
    createDeck(ws, { title, language, audioUrl }) {
      const id = nanoid(10);
      const deck = {
        id,
        workspaceId: ws,
        title: title?.trim() || "Untitled deck",
        language: language?.trim() || "",
        audioUrl: audioUrl || null,
        createdAt: Date.now(),
        cardOrder: [],
        shareId: null,
      };
      state.decks[id] = deck;
      persist();
      return deck;
    },

    listDecks(ws) {
      return decksOf(ws)
        .map((d) => ({
          ...d,
          cardCount: d.cardOrder.length,
          dueCount: d.cardOrder.filter((cid) => state.cards[cid] && isDue(state.cards[cid].srs)).length,
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    getDeck(id, ws) {
      const deck = deckOwned(id, ws);
      if (!deck) return null;
      const cards = deck.cardOrder.map((cid) => state.cards[cid]).filter(Boolean);
      return { ...deck, cards };
    },

    // Cross-deck review alert: what's due now and when the next card comes up.
    dueSummary(ws, now = Date.now()) {
      const decks = decksOf(ws).map((d) => {
        const cards = d.cardOrder.map((cid) => state.cards[cid]).filter(Boolean);
        const dueCount = cards.filter((c) => isDue(c.srs, now)).length;
        const nextDue = cards.length ? Math.min(...cards.map((c) => c.srs.due)) : null;
        return { id: d.id, title: d.title, language: d.language, cardCount: cards.length, dueCount, nextDue };
      });
      const decksDue = decks.filter((d) => d.dueCount > 0).sort((a, b) => b.dueCount - a.dueCount);
      const upcoming = decks.map((d) => d.nextDue).filter((t) => t != null && t > now).sort((a, b) => a - b);
      return {
        totalDue: decksDue.reduce((sum, d) => sum + d.dueCount, 0),
        deckCount: decks.length,
        decksDue,
        nextDue: upcoming[0] ?? null,
        generatedAt: now,
      };
    },

    deleteDeck(id, ws) {
      const deck = deckOwned(id, ws);
      if (!deck) return false;
      for (const cid of deck.cardOrder) delete state.cards[cid];
      delete state.decks[id];
      persist();
      return true;
    },

    // --- cards ---------------------------------------------------------
    addCards(deckId, segments, ws) {
      const deck = deckOwned(deckId, ws);
      if (!deck) return null;
      const now = Date.now();
      const created = [];
      for (const seg of segments) {
        const id = nanoid(10);
        const card = {
          id,
          deckId,
          front: seg.text ?? "",
          back: seg.back ?? "",
          notes: seg.notes ?? "",
          start: seg.start ?? null,
          end: seg.end ?? null,
          tags: seg.tags ?? [],
          cloze: seg.cloze ?? null,
          srs: freshSrs(now),
        };
        state.cards[id] = card;
        deck.cardOrder.push(id);
        created.push(card);
      }
      persist();
      return created;
    },

    updateCard(id, patch, ws) {
      const card = cardOwned(id, ws);
      if (!card) return null;
      for (const key of ["front", "back", "notes"]) {
        if (key in patch) card[key] = patch[key];
      }
      if ("tags" in patch && Array.isArray(patch.tags)) card.tags = patch.tags;
      if ("start" in patch) card.start = patch.start;
      if ("end" in patch) card.end = patch.end;
      // cloze may be set to a term or cleared with null.
      if ("cloze" in patch) card.cloze = patch.cloze || null;
      persist();
      return card;
    },

    deleteCard(id, ws) {
      const card = cardOwned(id, ws);
      if (!card) return false;
      const deck = state.decks[card.deckId];
      if (deck) deck.cardOrder = deck.cardOrder.filter((cid) => cid !== id);
      delete state.cards[id];
      persist();
      return true;
    },

    reviewCard(id, grade, ws, now = Date.now()) {
      const card = cardOwned(id, ws);
      if (!card) return null;
      card.srs = review(card.srs, grade, now);
      state.reviewLog.push({ workspaceId: ws, cardId: id, deckId: card.deckId, grade: card.srs.lastGrade, at: now });
      if (state.reviewLog.length > MAX_LOG) state.reviewLog = state.reviewLog.slice(-MAX_LOG);
      persist();
      return card;
    },

    dueCards(deckId, ws, now = Date.now()) {
      const deck = deckOwned(deckId, ws);
      if (!deck) return null;
      return deck.cardOrder
        .map((cid) => state.cards[cid])
        .filter((c) => c && isDue(c.srs, now))
        .sort((a, b) => a.srs.due - b.srs.due);
    },

    // Auto-assign a cloze term to every card that doesn't have one yet.
    generateClozeForDeck(deckId, ws, { overwrite = false } = {}) {
      const deck = deckOwned(deckId, ws);
      if (!deck) return null;
      let updated = 0;
      for (const cid of deck.cardOrder) {
        const card = state.cards[cid];
        if (!card) continue;
        if (card.cloze && !overwrite) continue;
        const term = suggestCloze(card.front);
        if (term) {
          card.cloze = term;
          updated++;
        }
      }
      if (updated) persist();
      return { updated };
    },

    // --- sharing -------------------------------------------------------
    publishDeck(id, ws) {
      const deck = deckOwned(id, ws);
      if (!deck) return null;
      if (!deck.shareId) {
        deck.shareId = nanoid(16);
        persist();
      }
      return deck;
    },

    unpublishDeck(id, ws) {
      const deck = deckOwned(id, ws);
      if (!deck) return null;
      if (deck.shareId) {
        deck.shareId = null;
        persist();
      }
      return deck;
    },

    // Public, read-only view of a shared deck (resolves globally by share id).
    getSharedDeck(shareId) {
      const deck = Object.values(state.decks).find((d) => d.shareId === shareId);
      if (!deck) return null;
      const cards = deck.cardOrder
        .map((cid) => state.cards[cid])
        .filter(Boolean)
        .map((c) => ({ front: c.front, back: c.back, notes: c.notes, start: c.start, end: c.end, tags: c.tags, cloze: c.cloze ?? null }));
      return { shareId, title: deck.title, language: deck.language, audioUrl: deck.audioUrl, cards };
    },

    // Aggregated study statistics for the dashboard (workspace-scoped).
    stats(ws, now = Date.now()) {
      const cards = decksOf(ws).flatMap((d) => d.cardOrder.map((cid) => state.cards[cid]).filter(Boolean));
      const log = state.reviewLog.filter((e) => e.workspaceId === ws);
      return computeStats(log, cards, now);
    },

    // Case-insensitive substring search across the workspace's cards.
    searchCards(ws, query, limit = 50) {
      const q = (query ?? "").trim().toLowerCase();
      if (!q) return [];
      const out = [];
      for (const deck of decksOf(ws)) {
        for (const cid of deck.cardOrder) {
          const c = state.cards[cid];
          if (!c) continue;
          const front = (c.front ?? "").toLowerCase();
          const back = (c.back ?? "").toLowerCase();
          const notes = (c.notes ?? "").toLowerCase();
          const field = front.includes(q) ? "front" : back.includes(q) ? "back" : notes.includes(q) ? "notes" : null;
          if (!field) continue;
          out.push({
            cardId: c.id, deckId: deck.id, deckTitle: deck.title, language: deck.language,
            front: c.front, back: c.back, notes: c.notes, start: c.start, end: c.end, field,
          });
          if (out.length >= limit) return out;
        }
      }
      return out;
    },

    // For tests / inspection.
    _state: () => state,
    _reset: () => {
      state = structuredClone(EMPTY);
      persist();
    },
  };

  return api;
}

function load(filePath) {
  try {
    if (existsSync(filePath)) {
      const parsed = JSON.parse(readFileSync(filePath, "utf8"));
      return {
        workspaces: parsed.workspaces ?? {},
        decks: parsed.decks ?? {},
        cards: parsed.cards ?? {},
        reviewLog: parsed.reviewLog ?? [],
      };
    }
  } catch {
    // Corrupt or unreadable file: start clean rather than crash.
  }
  return structuredClone(EMPTY);
}
