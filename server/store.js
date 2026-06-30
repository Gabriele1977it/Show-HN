// Tiny persistent store.
//
// EchoDeck's data set is small (a creator's decks and cards), so a single
// JSON document with atomic writes is plenty and keeps the MVP dependency-free.
// The shape is intentionally flat so it is trivial to inspect or export.

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { nanoid } from "nanoid";
import { freshSrs, review, isDue } from "./srs.js";
import { computeStats } from "./stats.js";

const EMPTY = { decks: {}, cards: {}, reviewLog: [] };

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

  const api = {
    // --- decks ---------------------------------------------------------
    createDeck({ title, language, audioUrl }) {
      const id = nanoid(10);
      const deck = {
        id,
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

    listDecks() {
      return Object.values(state.decks)
        .map((d) => ({
          ...d,
          cardCount: d.cardOrder.length,
          dueCount: d.cardOrder.filter((cid) => state.cards[cid] && isDue(state.cards[cid].srs)).length,
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    getDeck(id) {
      const deck = state.decks[id];
      if (!deck) return null;
      const cards = deck.cardOrder.map((cid) => state.cards[cid]).filter(Boolean);
      return { ...deck, cards };
    },

    // Cross-deck review alert: what's due now and when the next card comes up.
    // This is the surface a creator (or a mobile push) checks each day.
    dueSummary(now = Date.now()) {
      const decks = Object.values(state.decks).map((d) => {
        const cards = d.cardOrder.map((cid) => state.cards[cid]).filter(Boolean);
        const dueCount = cards.filter((c) => isDue(c.srs, now)).length;
        const nextDue = cards.length ? Math.min(...cards.map((c) => c.srs.due)) : null;
        return { id: d.id, title: d.title, language: d.language, cardCount: cards.length, dueCount, nextDue };
      });
      const decksDue = decks
        .filter((d) => d.dueCount > 0)
        .sort((a, b) => b.dueCount - a.dueCount);
      const upcoming = decks
        .map((d) => d.nextDue)
        .filter((t) => t != null && t > now)
        .sort((a, b) => a - b);
      return {
        totalDue: decksDue.reduce((sum, d) => sum + d.dueCount, 0),
        deckCount: decks.length,
        decksDue,
        nextDue: upcoming[0] ?? null,
        generatedAt: now,
      };
    },

    deleteDeck(id) {
      const deck = state.decks[id];
      if (!deck) return false;
      for (const cid of deck.cardOrder) delete state.cards[cid];
      delete state.decks[id];
      persist();
      return true;
    },

    // --- cards ---------------------------------------------------------
    addCards(deckId, segments) {
      const deck = state.decks[deckId];
      if (!deck) return [];
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
          srs: freshSrs(now),
        };
        state.cards[id] = card;
        deck.cardOrder.push(id);
        created.push(card);
      }
      persist();
      return created;
    },

    getCard(id) {
      return state.cards[id] ?? null;
    },

    updateCard(id, patch) {
      const card = state.cards[id];
      if (!card) return null;
      for (const key of ["front", "back", "notes"]) {
        if (key in patch) card[key] = patch[key];
      }
      if ("tags" in patch && Array.isArray(patch.tags)) card.tags = patch.tags;
      if ("start" in patch) card.start = patch.start;
      if ("end" in patch) card.end = patch.end;
      persist();
      return card;
    },

    deleteCard(id) {
      const card = state.cards[id];
      if (!card) return false;
      const deck = state.decks[card.deckId];
      if (deck) deck.cardOrder = deck.cardOrder.filter((cid) => cid !== id);
      delete state.cards[id];
      persist();
      return true;
    },

    reviewCard(id, grade, now = Date.now()) {
      const card = state.cards[id];
      if (!card) return null;
      card.srs = review(card.srs, grade, now);
      // Record the event for the stats dashboard (graded value is normalised).
      state.reviewLog.push({ cardId: id, deckId: card.deckId, grade: card.srs.lastGrade, at: now });
      if (state.reviewLog.length > MAX_LOG) {
        state.reviewLog = state.reviewLog.slice(-MAX_LOG);
      }
      persist();
      return card;
    },

    dueCards(deckId, now = Date.now()) {
      const deck = state.decks[deckId];
      if (!deck) return [];
      return deck.cardOrder
        .map((cid) => state.cards[cid])
        .filter((c) => c && isDue(c.srs, now))
        .sort((a, b) => a.srs.due - b.srs.due);
    },

    // --- sharing -------------------------------------------------------
    // Publishing assigns an unguessable share id; the deck stays unlisted but
    // anyone with the link can view and export it.
    publishDeck(id) {
      const deck = state.decks[id];
      if (!deck) return null;
      if (!deck.shareId) {
        deck.shareId = nanoid(16);
        persist();
      }
      return deck;
    },

    unpublishDeck(id) {
      const deck = state.decks[id];
      if (!deck) return null;
      if (deck.shareId) {
        deck.shareId = null;
        persist();
      }
      return deck;
    },

    // Public, read-only view of a shared deck: card content only, no private
    // scheduling state.
    getSharedDeck(shareId) {
      const deck = Object.values(state.decks).find((d) => d.shareId === shareId);
      if (!deck) return null;
      const cards = deck.cardOrder
        .map((cid) => state.cards[cid])
        .filter(Boolean)
        .map((c) => ({ front: c.front, back: c.back, notes: c.notes, start: c.start, end: c.end, tags: c.tags }));
      return { shareId, title: deck.title, language: deck.language, audioUrl: deck.audioUrl, cards };
    },

    // Aggregated study statistics for the dashboard.
    stats(now = Date.now()) {
      return computeStats(state.reviewLog, Object.values(state.cards), now);
    },

    // Case-insensitive substring search across every card's front/back/notes,
    // returning matches with their deck context. Preserves deck/card order.
    searchCards(query, limit = 50) {
      const q = (query ?? "").trim().toLowerCase();
      if (!q) return [];
      const out = [];
      for (const deck of Object.values(state.decks)) {
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
      return { decks: parsed.decks ?? {}, cards: parsed.cards ?? {}, reviewLog: parsed.reviewLog ?? [] };
    }
  } catch {
    // Corrupt or unreadable file: start clean rather than crash.
  }
  return structuredClone(EMPTY);
}
