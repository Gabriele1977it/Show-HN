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
import { hashPassword, verifyPassword, newToken, hashToken } from "./auth.js";

const EMPTY = { users: {}, sessions: {}, resets: {}, workspaces: {}, decks: {}, cards: {}, reviewLog: [], pushSubs: {}, invites: {} };

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESET_TTL = 60 * 60 * 1000; // 1 hour

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

    // Aggregate stats for the owner's /admin panel.
    adminOverview() {
      const wss = Object.values(state.workspaces);
      const decks = Object.values(state.decks);
      const users = Object.values(state.users);
      const dayAgo = Date.now() - 86400000;
      const plans = {};
      for (const w of wss) plans[w.plan || "free"] = (plans[w.plan || "free"] || 0) + 1;
      const deckAgg = {};
      for (const d of decks) {
        const a = (deckAgg[d.workspaceId] ??= { decks: 0, cards: 0 });
        a.decks += 1;
        a.cards += d.cardOrder.length;
      }
      const recentWorkspaces = [...wss].sort((a, b) => b.createdAt - a.createdAt).slice(0, 25).map((w) => ({
        id: w.id, name: w.name, plan: w.plan || "free", createdAt: w.createdAt,
        members: (w.members ?? []).length,
        decks: deckAgg[w.id]?.decks ?? 0, cards: deckAgg[w.id]?.cards ?? 0,
      }));
      const recentAccounts = [...users].sort((a, b) => b.createdAt - a.createdAt).slice(0, 25)
        .map((u) => ({ email: u.email, createdAt: u.createdAt, workspaces: (u.keychain ?? []).length }));
      return {
        totals: {
          workspaces: wss.length, accounts: users.length, decks: decks.length,
          cards: Object.keys(state.cards).length, reviews: state.reviewLog.length,
          shared: decks.filter((d) => d.shareId).length, listed: decks.filter((d) => d.listed).length,
        },
        reviews24h: state.reviewLog.filter((e) => e.at >= dayAgo).length,
        plans, recentWorkspaces, recentAccounts,
      };
    },

    getBilling(ws) {
      return state.workspaces[ws]?.billing ?? null;
    },

    // --- beta invites ----------------------------------------------------
    // Owner-minted codes that grant a plan (typically "tester") to whichever
    // workspaces redeem them, up to maxUses. Redeeming twice from the same
    // workspace is a no-op that doesn't consume a use.
    createInvite({ plan = "tester", maxUses = 25, note = "" } = {}) {
      const code = nanoid(10);
      state.invites[code] = { code, plan, maxUses, note: String(note || "").slice(0, 80), uses: 0, redeemedBy: [], createdAt: Date.now() };
      persist();
      return { ...state.invites[code] };
    },

    listInvites() {
      return Object.values(state.invites)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(({ redeemedBy, ...pub }) => pub);
    },

    redeemInvite(code, ws) {
      const inv = state.invites[code];
      if (!inv || !state.workspaces[ws]) return { error: "invalid" };
      if (inv.redeemedBy.includes(ws)) return { plan: inv.plan, already: true };
      if (inv.uses >= inv.maxUses) return { error: "exhausted" };
      inv.uses += 1;
      inv.redeemedBy.push(ws);
      state.workspaces[ws].plan = inv.plan;
      persist();
      return { plan: inv.plan };
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

    // Create a password-reset token for an email (if the account exists). The
    // raw token is returned (to email); only its hash is stored.
    createPasswordReset(email, now = Date.now()) {
      const e = (email ?? "").trim().toLowerCase();
      const user = Object.values(state.users).find((u) => u.email === e);
      if (!user) return null;
      const token = newToken();
      state.resets[hashToken(token)] = { userId: user.id, expiresAt: now + RESET_TTL };
      persist();
      return { token, email: user.email };
    },

    // Consume a reset token and set a new password. Invalidates the token and
    // all of the user's sessions.
    resetPassword(token, newPasswordValue, now = Date.now()) {
      const key = hashToken(token);
      const rec = state.resets[key];
      if (!rec) return { error: "invalid" };
      if (rec.expiresAt <= now) {
        delete state.resets[key];
        persist();
        return { error: "expired" };
      }
      const user = state.users[rec.userId];
      if (!user) return { error: "invalid" };
      const { salt, hash } = hashPassword(newPasswordValue);
      user.salt = salt;
      user.hash = hash;
      delete state.resets[key];
      // Log the user out everywhere after a password change.
      for (const [tok, s] of Object.entries(state.sessions)) {
        if (s.userId === user.id) delete state.sessions[tok];
      }
      persist();
      return { ok: true, email: user.email };
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
        listed: false,
        listedAt: null,
        description: "",
        installs: 0,
        views: 0,
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

    getCard(id, ws) {
      return cardOwned(id, ws);
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

    // Count one public view of a shared deck (creator analytics).
    recordShareView(shareId) {
      const deck = Object.values(state.decks).find((d) => d.shareId === shareId);
      if (deck) { deck.views = (deck.views || 0) + 1; persist(); }
    },

    // Per-deck reach for the workspace's shared/listed decks, plus totals.
    creatorStats(ws) {
      const decks = decksOf(ws)
        .filter((d) => d.shareId)
        .map((d) => ({
          deckId: d.id, title: d.title, language: d.language, shareId: d.shareId,
          listed: Boolean(d.listed), views: d.views || 0, installs: d.installs || 0, cardCount: d.cardOrder.length,
        }))
        .sort((a, b) => b.installs - a.installs || b.views - a.views);
      return {
        decks,
        totalViews: decks.reduce((s, d) => s + d.views, 0),
        totalInstalls: decks.reduce((s, d) => s + d.installs, 0),
        listedCount: decks.filter((d) => d.listed).length,
        sharedCount: decks.length,
      };
    },

    // --- marketplace ---------------------------------------------------
    // Listing publishes a deck to the public catalog. It implies sharing, so a
    // share id is minted if needed. Unlisting only removes it from the catalog;
    // the share link and description are kept for a one-click re-list.
    listDeck(id, ws, { description = "" } = {}) {
      const deck = deckOwned(id, ws);
      if (!deck) return null;
      if (!deck.shareId) deck.shareId = nanoid(16);
      deck.listed = true;
      deck.listedAt = Date.now();
      deck.description = String(description || "").slice(0, 300);
      persist();
      return { id, shareId: deck.shareId, listed: true, description: deck.description };
    },

    unlistDeck(id, ws) {
      const deck = deckOwned(id, ws);
      if (!deck) return null;
      if (deck.listed) { deck.listed = false; persist(); }
      return { id, listed: false };
    },

    // Public catalog of listed decks, most-installed / newest first, with an
    // optional text query and language filter.
    listMarketplace({ q = "", language = "", limit = 60 } = {}) {
      const needle = String(q || "").trim().toLowerCase();
      const lang = String(language || "").trim().toLowerCase();
      return Object.values(state.decks)
        .filter((d) => d.listed && d.shareId)
        .filter((d) => (!lang || (d.language || "").toLowerCase() === lang))
        .filter((d) => (!needle || `${d.title} ${d.description || ""} ${d.language || ""}`.toLowerCase().includes(needle)))
        .sort((a, b) => (b.installs || 0) - (a.installs || 0) || (b.listedAt || 0) - (a.listedAt || 0))
        .slice(0, limit)
        .map((d) => ({
          shareId: d.shareId, title: d.title, language: d.language, description: d.description || "",
          cardCount: d.cardOrder.length, installs: d.installs || 0,
          creator: state.workspaces[d.workspaceId]?.name ?? "Creator", listedAt: d.listedAt,
        }));
    },

    getListing(shareId) {
      const d = Object.values(state.decks).find((x) => x.shareId === shareId && x.listed);
      if (!d) return null;
      return {
        shareId: d.shareId, title: d.title, language: d.language, description: d.description || "",
        cardCount: d.cardOrder.length, installs: d.installs || 0,
        creator: state.workspaces[d.workspaceId]?.name ?? "Creator",
      };
    },

    // Clone a listed deck into `ws` as a fresh deck (new ids, reset SRS, not
    // shared/listed) and bump the source's install count.
    installListing(shareId, ws, now = Date.now()) {
      const src = Object.values(state.decks).find((x) => x.shareId === shareId && x.listed);
      if (!src) return null;
      const id = nanoid(10);
      const deck = {
        id, workspaceId: ws, title: src.title, language: src.language, audioUrl: src.audioUrl,
        createdAt: now, cardOrder: [], shareId: null, listed: false, listedAt: null, description: "", installs: 0, views: 0,
      };
      state.decks[id] = deck;
      for (const cid of src.cardOrder) {
        const c = state.cards[cid];
        if (!c) continue;
        const newCid = nanoid(10);
        state.cards[newCid] = {
          id: newCid, deckId: id, front: c.front, back: c.back, notes: c.notes,
          start: c.start, end: c.end, tags: [...(c.tags ?? [])], cloze: c.cloze ?? null, srs: freshSrs(now),
        };
        deck.cardOrder.push(newCid);
      }
      src.installs = (src.installs || 0) + 1;
      persist();
      return { deckId: id, title: src.title, cardCount: deck.cardOrder.length };
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

    // --- push subscriptions --------------------------------------------
    addPushSubscription(ws, sub) {
      if (!sub?.endpoint) return { error: "invalid" };
      state.pushSubs[sub.endpoint] = { workspaceId: ws, sub, createdAt: Date.now() };
      persist();
      return { ok: true };
    },
    listPushSubscriptions(ws) {
      return Object.values(state.pushSubs).filter((x) => x.workspaceId === ws).map((x) => x.sub);
    },
    removePushSubscription(ws, endpoint) {
      const e = state.pushSubs[endpoint];
      if (e && e.workspaceId === ws) { delete state.pushSubs[endpoint]; persist(); }
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
        resets: parsed.resets ?? {},
        workspaces: parsed.workspaces ?? {},
        decks: parsed.decks ?? {},
        cards: parsed.cards ?? {},
        reviewLog: parsed.reviewLog ?? [],
        pushSubs: parsed.pushSubs ?? {},
        invites: parsed.invites ?? {},
      };
    }
  } catch {
    // Corrupt or unreadable file: start clean rather than crash.
  }
  return structuredClone(EMPTY);
}
