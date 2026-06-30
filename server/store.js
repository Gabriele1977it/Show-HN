// Tiny persistent store.
//
// EchoDeck's data set is small (a creator's decks and cards), so a single
// JSON document with atomic writes is plenty and keeps the MVP dependency-free.
// The shape is intentionally flat so it is trivial to inspect or export.

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { nanoid } from "nanoid";
import { freshSrs, review, isDue } from "./srs.js";

const EMPTY = { decks: {}, cards: {} };

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
      return { decks: parsed.decks ?? {}, cards: parsed.cards ?? {} };
    }
  } catch {
    // Corrupt or unreadable file: start clean rather than crash.
  }
  return structuredClone(EMPTY);
}
