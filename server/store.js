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
import { hashPassword, verifyPassword, newToken } from "./auth.js";

const EMPTY = { users: {}, sessions: {}, workspaces: {}, decks: {}, cards: {}, reviewLog: [] };

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

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

  const ROLES = new Set(["admin", "editor", "viewer"]);
  const newMember = (name, role) => ({ id: nanoid(8), name: name?.trim() || "Member", role, key: nanoid(24), createdAt: Date.now() });

  const api = {
    ROLES,

    // --- workspaces & members ------------------------------------------
    // A workspace owns a list of members; each member has a role and an access
    // key. The creator is the first admin.
    createWorkspace({ name } = {}) {
      const id = nanoid(10);
      const owner = newMember("Owner", "admin");
      state.workspaces[id] = { id, name: name?.trim() || "My workspace", createdAt: Date.now(), members: [owner], plan: "free", billing: null };
      persist();
      return { id, name: state.workspaces[id].name, key: owner.key, role: "admin", memberId: owner.id };
    },

    // Resolve a key to its member + workspace, or null.
    getMemberByKey(key) {
      if (!key) return null;
      for (const ws of Object.values(state.workspaces)) {
        const m = (ws.members ?? []).find((x) => x.key === key);
        if (m) return { workspaceId: ws.id, memberId: m.id, role: m.role, name: m.name };
      }
      return null;
    },

    // Public-safe workspace info (no keys).
    getWorkspace(id) {
      const w = state.workspaces[id];
      return w ? { id: w.id, name: w.name, createdAt: w.createdAt, memberCount: (w.members ?? []).length } : null;
    },

    // Member list without keys (safe to show in the UI).
    listMembers(ws) {
      const w = state.workspaces[ws];
      if (!w) return [];
      return (w.members ?? []).map((m) => ({ id: m.id, name: m.name, role: m.role, createdAt: m.createdAt }));
    },

    // Mint a new member key with a role. Returns the member incl. its key (once).
    addMember(ws, { name, role }) {
      const w = state.workspaces[ws];
      if (!w) return null;
      if (!ROLES.has(role)) return { error: "invalid-role" };
      const m = newMember(name, role);
      w.members.push(m);
      persist();
      return { id: m.id, name: m.name, role: m.role, key: m.key, createdAt: m.createdAt };
    },

    // Remove a member. Refuses to remove the workspace's last admin.
    removeMember(ws, memberId) {
      const w = state.workspaces[ws];
      if (!w) return { error: "not-found" };
      const member = w.members.find((m) => m.id === memberId);
      if (!member) return { error: "not-found" };
      const admins = w.members.filter((m) => m.role === "admin");
      if (member.role === "admin" && admins.length === 1) return { error: "last-admin" };
      w.members = w.members.filter((m) => m.id !== memberId);
      persist();
      return { ok: true };
    },

    listWorkspaceIds() {
      return Object.keys(state.workspaces);
    },

    // --- plans / billing -----------------------------------------------
    getWorkspacePlan(ws) {
      return state.workspaces[ws]?.plan || "free";
    },

    setWorkspacePlan(ws, plan, billing = null) {
      const w = state.workspaces[ws];
      if (!w) return null;
      w.plan = plan;
      if (billing) w.billing = { ...(w.billing ?? {}), ...billing, updatedAt: Date.now() };
      persist();
      return { id: w.id, plan: w.plan, billing: w.billing };
    },

    // Current consumption, for limit checks and the usage meter.
    workspaceUsage(ws) {
      const decks = decksOf(ws);
      const cards = decks.reduce((n, d) => n + d.cardOrder.length, 0);
      const members = (state.workspaces[ws]?.members ?? []).length;
      return { decks: decks.length, cards, members };
    },

    findWorkspaceBySubscription(subId) {
      const w = Object.values(state.workspaces).find((x) => x.billing?.subscriptionId === subId);
      return w?.id ?? null;
    },

    getBilling(ws) {
      return state.workspaces[ws]?.billing ?? null;
    },

    // --- accounts ------------------------------------------------------
    // Named user accounts sit on top of member keys: an account stores a
    // "keychain" of the member keys it has access to, so a user can log in and
    // retrieve their workspaces instead of pasting raw keys.
    createUser({ email, password }) {
      const e = (email ?? "").trim().toLowerCase();
      if (Object.values(state.users).some((u) => u.email === e)) return { error: "exists" };
      const id = nanoid(10);
      const { salt, hash } = hashPassword(password);
      state.users[id] = { id, email: e, salt, hash, keychain: [], createdAt: Date.now() };
      persist();
      return { id, email: e };
    },

    authenticateUser(email, password) {
      const e = (email ?? "").trim().toLowerCase();
      const user = Object.values(state.users).find((u) => u.email === e);
      if (!user || !verifyPassword(password, user.salt, user.hash)) return null;
      return { id: user.id, email: user.email };
    },

    createSession(userId) {
      const token = newToken();
      state.sessions[token] = { userId, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL };
      persist();
      return token;
    },

    getUserBySession(token) {
      const s = token && state.sessions[token];
      if (!s) return null;
      if (s.expiresAt <= Date.now()) {
        delete state.sessions[token];
        persist();
        return null;
      }
      const user = state.users[s.userId];
      return user ? { id: user.id, email: user.email } : null;
    },

    deleteSession(token) {
      if (token && state.sessions[token]) {
        delete state.sessions[token];
        persist();
      }
    },

    // Save a member key to a user's keychain (deduped). Validates the key.
    addKeyToAccount(userId, memberKey) {
      const user = state.users[userId];
      if (!user) return { error: "no-user" };
      const member = api.getMemberByKey(memberKey);
      if (!member) return { error: "invalid-key" };
      if (!user.keychain.some((k) => k.memberKey === memberKey)) {
        user.keychain.push({ memberKey });
        persist();
      }
      return { ok: true };
    },

    // The account's keychain resolved to current workspace name + role; drops
    // keys that have since been revoked.
    getAccount(userId) {
      const user = state.users[userId];
      if (!user) return null;
      const keychain = [];
      for (const k of user.keychain) {
        const member = api.getMemberByKey(k.memberKey);
        if (!member) continue;
        const ws = state.workspaces[member.workspaceId];
        keychain.push({ workspaceId: member.workspaceId, workspaceName: ws?.name ?? "Workspace", role: member.role, memberKey: k.memberKey });
      }
      return { email: user.email, keychain };
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
        users: parsed.users ?? {},
        sessions: parsed.sessions ?? {},
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
