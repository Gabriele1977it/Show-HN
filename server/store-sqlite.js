// SQLite-backed store.
//
// Drop-in replacement for the JSON store (server/store.js): identical method
// signatures and return shapes, but data lives in a normalized SQLite database
// (durable, indexed, WAL crash-safety). better-sqlite3 is synchronous, so the
// store API stays synchronous and app.js / the routes are unchanged.

import Database from "better-sqlite3";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { nanoid } from "nanoid";
import { freshSrs, review, isDue } from "./srs.js";
import { computeStats } from "./stats.js";
import { suggestCloze } from "./cloze.js";
import { hashPassword, verifyPassword, newToken, hashToken } from "./auth.js";

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
const RESET_TTL = 60 * 60 * 1000;
const MAX_LOG = 5000;
const ROLES = new Set(["admin", "editor", "viewer"]);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, salt TEXT, hash TEXT,
  keychain TEXT NOT NULL DEFAULT '[]', created_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER, expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS resets (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY, name TEXT, created_at INTEGER,
  plan TEXT NOT NULL DEFAULT 'free', billing TEXT
);
CREATE TABLE IF NOT EXISTS members (
  key TEXT PRIMARY KEY, id TEXT NOT NULL, workspace_id TEXT NOT NULL,
  name TEXT, role TEXT, created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_members_ws ON members(workspace_id);
CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT, language TEXT,
  audio_url TEXT, created_at INTEGER, share_id TEXT UNIQUE,
  listed INTEGER NOT NULL DEFAULT 0, listed_at INTEGER, description TEXT, installs INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_decks_ws ON decks(workspace_id);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, deck_id TEXT NOT NULL, position INTEGER,
  front TEXT, back TEXT, notes TEXT, start_t REAL, end_t REAL,
  tags TEXT, cloze TEXT, srs TEXT
);
CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id, position);
CREATE TABLE IF NOT EXISTS review_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT, deck_id TEXT,
  card_id TEXT, grade INTEGER, at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_review_ws ON review_log(workspace_id);
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, sub TEXT NOT NULL, created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_push_ws ON push_subs(workspace_id);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY, plan TEXT NOT NULL, max_uses INTEGER NOT NULL,
  note TEXT, uses INTEGER NOT NULL DEFAULT 0, redeemed_by TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS arena_scorecards (
  id TEXT PRIMARY KEY, task TEXT, agent_count INTEGER,
  winner TEXT, winner_score INTEGER, data TEXT NOT NULL, created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_arena_created ON arena_scorecards(created_at);
`;

const newMember = (name, role) => ({ id: nanoid(8), name: name?.trim() || "Member", role, key: nanoid(24), createdAt: Date.now() });
const toCard = (r) => (r ? {
  id: r.id, deckId: r.deck_id, front: r.front, back: r.back, notes: r.notes,
  start: r.start_t, end: r.end_t, tags: JSON.parse(r.tags || "[]"), cloze: r.cloze ?? null,
  srs: JSON.parse(r.srs),
} : null);

export function createSqliteStore(dbPath, { migrateFrom } = {}) {
  if (dbPath !== ":memory:") {
    const dir = dirname(dbPath);
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  // Migrate older databases: add marketplace columns to `decks` if missing.
  const deckCols = new Set(db.prepare("PRAGMA table_info(decks)").all().map((c) => c.name));
  const addDeckCol = (name, ddl) => { if (!deckCols.has(name)) db.exec(`ALTER TABLE decks ADD COLUMN ${ddl}`); };
  addDeckCol("listed", "listed INTEGER NOT NULL DEFAULT 0");
  addDeckCol("listed_at", "listed_at INTEGER");
  addDeckCol("description", "description TEXT");
  addDeckCol("installs", "installs INTEGER NOT NULL DEFAULT 0");
  addDeckCol("views", "views INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE INDEX IF NOT EXISTS idx_decks_listed ON decks(listed)");

  const ownedDeck = (id, ws) => db.prepare("SELECT * FROM decks WHERE id=? AND workspace_id=?").get(id, ws);
  const ownedCard = (id, ws) =>
    db.prepare("SELECT c.* FROM cards c JOIN decks d ON c.deck_id=d.id WHERE c.id=? AND d.workspace_id=?").get(id, ws);
  const cardsOfDeck = (deckId) => db.prepare("SELECT * FROM cards WHERE deck_id=? ORDER BY position").all(deckId);

  const api = {
    ROLES,

    // --- workspaces & members ----------------------------------------
    createWorkspace({ name } = {}) {
      const id = nanoid(10);
      const owner = newMember("Owner", "admin");
      const tx = db.transaction(() => {
        db.prepare("INSERT INTO workspaces (id,name,created_at,plan,billing) VALUES (?,?,?,?,NULL)")
          .run(id, name?.trim() || "My workspace", Date.now(), "free");
        db.prepare("INSERT INTO members (key,id,workspace_id,name,role,created_at) VALUES (?,?,?,?,?,?)")
          .run(owner.key, owner.id, id, owner.name, owner.role, owner.createdAt);
      });
      tx();
      const ws = db.prepare("SELECT name FROM workspaces WHERE id=?").get(id);
      return { id, name: ws.name, key: owner.key, role: "admin", memberId: owner.id };
    },

    getMemberByKey(key) {
      if (!key) return null;
      const m = db.prepare("SELECT * FROM members WHERE key=?").get(key);
      return m ? { workspaceId: m.workspace_id, memberId: m.id, role: m.role, name: m.name } : null;
    },

    getWorkspace(id) {
      const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(id);
      if (!w) return null;
      const memberCount = db.prepare("SELECT count(*) n FROM members WHERE workspace_id=?").get(id).n;
      return { id: w.id, name: w.name, createdAt: w.created_at, memberCount };
    },

    listMembers(ws) {
      return db.prepare("SELECT id,name,role,created_at FROM members WHERE workspace_id=? ORDER BY created_at").all(ws)
        .map((m) => ({ id: m.id, name: m.name, role: m.role, createdAt: m.created_at }));
    },

    addMember(ws, { name, role }) {
      if (!db.prepare("SELECT 1 FROM workspaces WHERE id=?").get(ws)) return null;
      if (!ROLES.has(role)) return { error: "invalid-role" };
      const m = newMember(name, role);
      db.prepare("INSERT INTO members (key,id,workspace_id,name,role,created_at) VALUES (?,?,?,?,?,?)")
        .run(m.key, m.id, ws, m.name, m.role, m.createdAt);
      return { id: m.id, name: m.name, role: m.role, key: m.key, createdAt: m.createdAt };
    },

    removeMember(ws, memberId) {
      if (!db.prepare("SELECT 1 FROM workspaces WHERE id=?").get(ws)) return { error: "not-found" };
      const member = db.prepare("SELECT * FROM members WHERE workspace_id=? AND id=?").get(ws, memberId);
      if (!member) return { error: "not-found" };
      const admins = db.prepare("SELECT count(*) n FROM members WHERE workspace_id=? AND role='admin'").get(ws).n;
      if (member.role === "admin" && admins === 1) return { error: "last-admin" };
      db.prepare("DELETE FROM members WHERE workspace_id=? AND id=?").run(ws, memberId);
      return { ok: true };
    },

    listWorkspaceIds() {
      return db.prepare("SELECT id FROM workspaces").all().map((r) => r.id);
    },

    // --- plans / billing ---------------------------------------------
    getWorkspacePlan(ws) {
      return db.prepare("SELECT plan FROM workspaces WHERE id=?").get(ws)?.plan || "free";
    },

    setWorkspacePlan(ws, plan, billing = null) {
      const w = db.prepare("SELECT billing FROM workspaces WHERE id=?").get(ws);
      if (!w) return null;
      let merged = w.billing ? JSON.parse(w.billing) : null;
      if (billing) merged = { ...(merged ?? {}), ...billing, updatedAt: Date.now() };
      db.prepare("UPDATE workspaces SET plan=?, billing=? WHERE id=?").run(plan, merged ? JSON.stringify(merged) : null, ws);
      return { id: ws, plan, billing: merged };
    },

    workspaceUsage(ws) {
      const decks = db.prepare("SELECT count(*) n FROM decks WHERE workspace_id=?").get(ws).n;
      const cards = db.prepare("SELECT count(*) n FROM cards c JOIN decks d ON c.deck_id=d.id WHERE d.workspace_id=?").get(ws).n;
      const members = db.prepare("SELECT count(*) n FROM members WHERE workspace_id=?").get(ws).n;
      return { decks, cards, members };
    },

    findWorkspaceBySubscription(subId) {
      const r = db.prepare("SELECT id FROM workspaces WHERE json_extract(billing,'$.subscriptionId')=?").get(subId);
      return r?.id ?? null;
    },

    // Aggregate stats for the owner's /admin panel.
    adminOverview() {
      const one = (sql, ...p) => db.prepare(sql).get(...p);
      const plans = {};
      for (const r of db.prepare("SELECT plan, COUNT(*) n FROM workspaces GROUP BY plan").all()) {
        plans[r.plan || "free"] = r.n;
      }
      const recentWorkspaces = db.prepare(`
        SELECT w.id, w.name, w.plan, w.created_at,
          (SELECT COUNT(*) FROM members m WHERE m.workspace_id = w.id) AS members,
          (SELECT COUNT(*) FROM decks d WHERE d.workspace_id = w.id) AS decks,
          (SELECT COUNT(*) FROM cards c JOIN decks d2 ON c.deck_id = d2.id WHERE d2.workspace_id = w.id) AS cards
        FROM workspaces w ORDER BY w.created_at DESC LIMIT 25
      `).all().map((r) => ({ id: r.id, name: r.name, plan: r.plan || "free", createdAt: r.created_at, members: r.members, decks: r.decks, cards: r.cards }));
      const recentAccounts = db.prepare("SELECT email, created_at, keychain FROM users ORDER BY created_at DESC LIMIT 25")
        .all().map((r) => ({ email: r.email, createdAt: r.created_at, workspaces: JSON.parse(r.keychain || "[]").length }));
      return {
        totals: {
          workspaces: one("SELECT COUNT(*) n FROM workspaces").n,
          accounts: one("SELECT COUNT(*) n FROM users").n,
          decks: one("SELECT COUNT(*) n FROM decks").n,
          cards: one("SELECT COUNT(*) n FROM cards").n,
          reviews: one("SELECT COUNT(*) n FROM review_log").n,
          shared: one("SELECT COUNT(*) n FROM decks WHERE share_id IS NOT NULL").n,
          listed: one("SELECT COUNT(*) n FROM decks WHERE listed=1").n,
        },
        reviews24h: one("SELECT COUNT(*) n FROM review_log WHERE at >= ?", Date.now() - 86400000).n,
        plans, recentWorkspaces, recentAccounts,
      };
    },

    getBilling(ws) {
      const w = db.prepare("SELECT billing FROM workspaces WHERE id=?").get(ws);
      return w?.billing ? JSON.parse(w.billing) : null;
    },

    // --- beta invites ----------------------------------------------------
    // Owner-minted codes that grant a plan (typically "tester") to whichever
    // workspaces redeem them, up to maxUses. Redeeming twice from the same
    // workspace is a no-op that doesn't consume a use.
    createInvite({ plan = "tester", maxUses = 25, note = "" } = {}) {
      const code = nanoid(10);
      const createdAt = Date.now();
      db.prepare("INSERT INTO invites (code, plan, max_uses, note, uses, redeemed_by, created_at) VALUES (?,?,?,?,0,'[]',?)")
        .run(code, plan, maxUses, String(note || "").slice(0, 80), createdAt);
      return { code, plan, maxUses, note: String(note || "").slice(0, 80), uses: 0, createdAt };
    },

    listInvites() {
      return db.prepare("SELECT code, plan, max_uses, note, uses, created_at FROM invites ORDER BY created_at DESC").all()
        .map((r) => ({ code: r.code, plan: r.plan, maxUses: r.max_uses, note: r.note, uses: r.uses, createdAt: r.created_at }));
    },

    redeemInvite(code, ws) {
      const inv = db.prepare("SELECT * FROM invites WHERE code=?").get(code);
      const wsRow = db.prepare("SELECT id FROM workspaces WHERE id=?").get(ws);
      if (!inv || !wsRow) return { error: "invalid" };
      const redeemedBy = JSON.parse(inv.redeemed_by || "[]");
      if (redeemedBy.includes(ws)) return { plan: inv.plan, already: true };
      if (inv.uses >= inv.max_uses) return { error: "exhausted" };
      redeemedBy.push(ws);
      db.prepare("UPDATE invites SET uses = uses + 1, redeemed_by = ? WHERE code = ?").run(JSON.stringify(redeemedBy), code);
      db.prepare("UPDATE workspaces SET plan = ? WHERE id = ?").run(inv.plan, ws);
      return { plan: inv.plan };
    },

    // Revoke an invite: the link stops working immediately. Workspaces that
    // already redeemed it keep their plan (downgrade them from the admin panel
    // if needed).
    revokeInvite(code) {
      const r = db.prepare("DELETE FROM invites WHERE code = ?").run(code);
      return r.changes ? { ok: true } : { error: "invalid" };
    },

    // --- accounts ----------------------------------------------------
    createUser({ email, password }) {
      const e = (email ?? "").trim().toLowerCase();
      if (db.prepare("SELECT 1 FROM users WHERE email=?").get(e)) return { error: "exists" };
      const id = nanoid(10);
      const { salt, hash } = hashPassword(password);
      db.prepare("INSERT INTO users (id,email,salt,hash,keychain,created_at) VALUES (?,?,?,?,'[]',?)")
        .run(id, e, salt, hash, Date.now());
      return { id, email: e };
    },

    authenticateUser(email, password) {
      const e = (email ?? "").trim().toLowerCase();
      const u = db.prepare("SELECT * FROM users WHERE email=?").get(e);
      if (!u || !verifyPassword(password, u.salt, u.hash)) return null;
      return { id: u.id, email: u.email };
    },

    createSession(userId) {
      const token = newToken();
      db.prepare("INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)")
        .run(token, userId, Date.now(), Date.now() + SESSION_TTL);
      return token;
    },

    getUserBySession(token) {
      const s = token && db.prepare("SELECT * FROM sessions WHERE token=?").get(token);
      if (!s) return null;
      if (s.expires_at <= Date.now()) {
        db.prepare("DELETE FROM sessions WHERE token=?").run(token);
        return null;
      }
      const u = db.prepare("SELECT id,email FROM users WHERE id=?").get(s.user_id);
      return u ? { id: u.id, email: u.email } : null;
    },

    deleteSession(token) {
      if (token) db.prepare("DELETE FROM sessions WHERE token=?").run(token);
    },

    createPasswordReset(email, now = Date.now()) {
      const e = (email ?? "").trim().toLowerCase();
      const u = db.prepare("SELECT * FROM users WHERE email=?").get(e);
      if (!u) return null;
      const token = newToken();
      db.prepare("INSERT OR REPLACE INTO resets (token_hash,user_id,expires_at) VALUES (?,?,?)")
        .run(hashToken(token), u.id, now + RESET_TTL);
      return { token, email: u.email };
    },

    resetPassword(token, newPasswordValue, now = Date.now()) {
      const key = hashToken(token);
      const rec = db.prepare("SELECT * FROM resets WHERE token_hash=?").get(key);
      if (!rec) return { error: "invalid" };
      if (rec.expires_at <= now) {
        db.prepare("DELETE FROM resets WHERE token_hash=?").run(key);
        return { error: "expired" };
      }
      const u = db.prepare("SELECT * FROM users WHERE id=?").get(rec.user_id);
      if (!u) return { error: "invalid" };
      const { salt, hash } = hashPassword(newPasswordValue);
      const tx = db.transaction(() => {
        db.prepare("UPDATE users SET salt=?, hash=? WHERE id=?").run(salt, hash, u.id);
        db.prepare("DELETE FROM resets WHERE token_hash=?").run(key);
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
      });
      tx();
      return { ok: true, email: u.email };
    },

    addKeyToAccount(userId, memberKey) {
      const u = db.prepare("SELECT keychain FROM users WHERE id=?").get(userId);
      if (!u) return { error: "no-user" };
      if (!api.getMemberByKey(memberKey)) return { error: "invalid-key" };
      const keychain = JSON.parse(u.keychain || "[]");
      if (!keychain.some((k) => k.memberKey === memberKey)) {
        keychain.push({ memberKey });
        db.prepare("UPDATE users SET keychain=? WHERE id=?").run(JSON.stringify(keychain), userId);
      }
      return { ok: true };
    },

    getAccount(userId) {
      const u = db.prepare("SELECT email,keychain FROM users WHERE id=?").get(userId);
      if (!u) return null;
      const keychain = [];
      for (const k of JSON.parse(u.keychain || "[]")) {
        const m = api.getMemberByKey(k.memberKey);
        if (!m) continue;
        const ws = db.prepare("SELECT name FROM workspaces WHERE id=?").get(m.workspaceId);
        keychain.push({ workspaceId: m.workspaceId, workspaceName: ws?.name ?? "Workspace", role: m.role, memberKey: k.memberKey });
      }
      return { email: u.email, keychain };
    },

    // --- decks -------------------------------------------------------
    createDeck(ws, { title, language, audioUrl }) {
      const id = nanoid(10);
      db.prepare("INSERT INTO decks (id,workspace_id,title,language,audio_url,created_at,share_id) VALUES (?,?,?,?,?,?,NULL)")
        .run(id, ws, title?.trim() || "Untitled deck", language?.trim() || "", audioUrl || null, Date.now());
      return { id, workspaceId: ws, title: title?.trim() || "Untitled deck", language: language?.trim() || "", audioUrl: audioUrl || null, shareId: null, listed: false, description: "", installs: 0, views: 0 };
    },

    listDecks(ws) {
      const decks = db.prepare("SELECT * FROM decks WHERE workspace_id=? ORDER BY created_at DESC").all(ws);
      const now = Date.now();
      return decks.map((d) => {
        const srsRows = db.prepare("SELECT srs FROM cards WHERE deck_id=?").all(d.id);
        const dueCount = srsRows.filter((r) => isDue(JSON.parse(r.srs), now)).length;
        return {
          id: d.id, workspaceId: d.workspace_id, title: d.title, language: d.language,
          audioUrl: d.audio_url, createdAt: d.created_at, shareId: d.share_id,
          listed: !!d.listed, description: d.description || "", installs: d.installs || 0, views: d.views || 0,
          cardCount: srsRows.length, dueCount,
        };
      });
    },

    getDeck(id, ws) {
      const d = ownedDeck(id, ws);
      if (!d) return null;
      return {
        id: d.id, workspaceId: d.workspace_id, title: d.title, language: d.language,
        audioUrl: d.audio_url, createdAt: d.created_at, shareId: d.share_id,
        listed: !!d.listed, description: d.description || "", installs: d.installs || 0, views: d.views || 0,
        cards: cardsOfDeck(d.id).map(toCard),
      };
    },

    deleteDeck(id, ws) {
      if (!ownedDeck(id, ws)) return false;
      const tx = db.transaction(() => {
        db.prepare("DELETE FROM cards WHERE deck_id=?").run(id);
        db.prepare("DELETE FROM decks WHERE id=?").run(id);
      });
      tx();
      return true;
    },

    dueSummary(ws, now = Date.now()) {
      const decks = db.prepare("SELECT id,title,language FROM decks WHERE workspace_id=?").all(ws).map((d) => {
        const cards = db.prepare("SELECT srs FROM cards WHERE deck_id=?").all(d.id).map((r) => JSON.parse(r.srs));
        const dueCount = cards.filter((s) => isDue(s, now)).length;
        const nextDue = cards.length ? Math.min(...cards.map((s) => s.due)) : null;
        return { id: d.id, title: d.title, language: d.language, cardCount: cards.length, dueCount, nextDue };
      });
      const decksDue = decks.filter((d) => d.dueCount > 0).sort((a, b) => b.dueCount - a.dueCount);
      const upcoming = decks.map((d) => d.nextDue).filter((t) => t != null && t > now).sort((a, b) => a - b);
      return {
        totalDue: decksDue.reduce((s, d) => s + d.dueCount, 0),
        deckCount: decks.length, decksDue, nextDue: upcoming[0] ?? null, generatedAt: now,
      };
    },

    // --- cards -------------------------------------------------------
    addCards(deckId, segments, ws) {
      if (!ownedDeck(deckId, ws)) return null;
      const now = Date.now();
      let pos = (db.prepare("SELECT max(position) m FROM cards WHERE deck_id=?").get(deckId).m ?? -1);
      const insert = db.prepare("INSERT INTO cards (id,deck_id,position,front,back,notes,start_t,end_t,tags,cloze,srs) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
      const created = [];
      const tx = db.transaction(() => {
        for (const seg of segments) {
          const id = nanoid(10);
          const card = {
            id, deckId, front: seg.text ?? "", back: seg.back ?? "", notes: seg.notes ?? "",
            start: seg.start ?? null, end: seg.end ?? null, tags: seg.tags ?? [], cloze: seg.cloze ?? null, srs: freshSrs(now),
          };
          insert.run(id, deckId, ++pos, card.front, card.back, card.notes, card.start, card.end, JSON.stringify(card.tags), card.cloze, JSON.stringify(card.srs));
          created.push(card);
        }
      });
      tx();
      return created;
    },

    getCard(id, ws) {
      const c = ownedCard(id, ws);
      return c ? toCard(c) : null;
    },

    updateCard(id, patch, ws) {
      const c = ownedCard(id, ws);
      if (!c) return null;
      const cur = toCard(c);
      for (const k of ["front", "back", "notes"]) if (k in patch) cur[k] = patch[k];
      if ("tags" in patch && Array.isArray(patch.tags)) cur.tags = patch.tags;
      if ("start" in patch) cur.start = patch.start;
      if ("end" in patch) cur.end = patch.end;
      if ("cloze" in patch) cur.cloze = patch.cloze || null;
      db.prepare("UPDATE cards SET front=?,back=?,notes=?,start_t=?,end_t=?,tags=?,cloze=? WHERE id=?")
        .run(cur.front, cur.back, cur.notes, cur.start, cur.end, JSON.stringify(cur.tags), cur.cloze, id);
      return cur;
    },

    deleteCard(id, ws) {
      if (!ownedCard(id, ws)) return false;
      db.prepare("DELETE FROM cards WHERE id=?").run(id);
      return true;
    },

    reviewCard(id, grade, ws, now = Date.now()) {
      const c = ownedCard(id, ws);
      if (!c) return null;
      const card = toCard(c);
      card.srs = review(card.srs, grade, now);
      const tx = db.transaction(() => {
        db.prepare("UPDATE cards SET srs=? WHERE id=?").run(JSON.stringify(card.srs), id);
        db.prepare("INSERT INTO review_log (workspace_id,deck_id,card_id,grade,at) VALUES (?,?,?,?,?)")
          .run(ws, card.deckId, id, card.srs.lastGrade, now);
        db.prepare("DELETE FROM review_log WHERE seq <= (SELECT max(seq) FROM review_log) - ?").run(MAX_LOG);
      });
      tx();
      return card;
    },

    dueCards(deckId, ws, now = Date.now()) {
      if (!ownedDeck(deckId, ws)) return null;
      return cardsOfDeck(deckId).map(toCard).filter((c) => isDue(c.srs, now)).sort((a, b) => a.srs.due - b.srs.due);
    },

    generateClozeForDeck(deckId, ws, { overwrite = false } = {}) {
      if (!ownedDeck(deckId, ws)) return null;
      let updated = 0;
      const upd = db.prepare("UPDATE cards SET cloze=? WHERE id=?");
      const tx = db.transaction(() => {
        for (const c of cardsOfDeck(deckId)) {
          if (c.cloze && !overwrite) continue;
          const term = suggestCloze(c.front);
          if (term) { upd.run(term, c.id); updated++; }
        }
      });
      tx();
      return { updated };
    },

    // --- sharing -----------------------------------------------------
    publishDeck(id, ws) {
      const d = ownedDeck(id, ws);
      if (!d) return null;
      let shareId = d.share_id;
      if (!shareId) {
        shareId = nanoid(16);
        db.prepare("UPDATE decks SET share_id=? WHERE id=?").run(shareId, id);
      }
      return { id, shareId };
    },

    unpublishDeck(id, ws) {
      const d = ownedDeck(id, ws);
      if (!d) return null;
      if (d.share_id) db.prepare("UPDATE decks SET share_id=NULL WHERE id=?").run(id);
      return { id, shareId: null };
    },

    getSharedDeck(shareId) {
      const d = db.prepare("SELECT * FROM decks WHERE share_id=?").get(shareId);
      if (!d) return null;
      const cards = cardsOfDeck(d.id).map((r) => {
        const c = toCard(r);
        return { front: c.front, back: c.back, notes: c.notes, start: c.start, end: c.end, tags: c.tags, cloze: c.cloze };
      });
      return { shareId, title: d.title, language: d.language, audioUrl: d.audio_url, cards };
    },

    // Count one public view of a shared deck (creator analytics).
    recordShareView(shareId) {
      db.prepare("UPDATE decks SET views=views+1 WHERE share_id=?").run(shareId);
    },

    // Per-deck reach for the workspace's shared/listed decks, plus totals.
    creatorStats(ws) {
      const rows = db.prepare(
        "SELECT d.id,d.title,d.language,d.share_id,d.listed,d.views,d.installs, " +
        "(SELECT count(*) FROM cards c WHERE c.deck_id=d.id) card_count " +
        "FROM decks d WHERE d.workspace_id=? AND d.share_id IS NOT NULL ORDER BY d.installs DESC, d.views DESC").all(ws);
      const decks = rows.map((r) => ({
        deckId: r.id, title: r.title, language: r.language, shareId: r.share_id,
        listed: !!r.listed, views: r.views || 0, installs: r.installs || 0, cardCount: r.card_count,
      }));
      return {
        decks,
        totalViews: decks.reduce((s, d) => s + d.views, 0),
        totalInstalls: decks.reduce((s, d) => s + d.installs, 0),
        listedCount: decks.filter((d) => d.listed).length,
        sharedCount: decks.length,
      };
    },

    // --- marketplace -------------------------------------------------
    // Listing a deck publishes it to the public catalog. It implies sharing
    // (a listed deck must be publicly viewable), so we mint a share id if
    // needed. Unlisting only removes it from the catalog; the share link and
    // description are preserved so re-listing is a one-click round trip.
    listDeck(id, ws, { description = "" } = {}) {
      const d = ownedDeck(id, ws);
      if (!d) return null;
      const shareId = d.share_id || nanoid(16);
      const desc = String(description || "").slice(0, 300);
      db.prepare("UPDATE decks SET share_id=?, listed=1, listed_at=?, description=? WHERE id=?")
        .run(shareId, Date.now(), desc, id);
      return { id, shareId, listed: true, description: desc };
    },

    unlistDeck(id, ws) {
      const d = ownedDeck(id, ws);
      if (!d) return null;
      if (d.listed) db.prepare("UPDATE decks SET listed=0 WHERE id=?").run(id);
      return { id, listed: false };
    },

    // Public catalog of listed decks, newest-and-most-installed first, with an
    // optional text query (title/description/language) and language filter.
    listMarketplace({ q = "", language = "", limit = 60 } = {}) {
      const rows = db.prepare(
        "SELECT d.*, w.name AS ws_name, (SELECT count(*) FROM cards c WHERE c.deck_id=d.id) AS card_count " +
        "FROM decks d JOIN workspaces w ON d.workspace_id=w.id WHERE d.listed=1 " +
        "ORDER BY d.installs DESC, d.listed_at DESC").all();
      const needle = String(q || "").trim().toLowerCase();
      const lang = String(language || "").trim().toLowerCase();
      const out = [];
      for (const d of rows) {
        if (lang && (d.language || "").toLowerCase() !== lang) continue;
        if (needle && !`${d.title} ${d.description || ""} ${d.language || ""}`.toLowerCase().includes(needle)) continue;
        out.push({
          shareId: d.share_id, title: d.title, language: d.language, description: d.description || "",
          cardCount: d.card_count, installs: d.installs || 0, creator: d.ws_name, listedAt: d.listed_at,
        });
        if (out.length >= limit) break;
      }
      return out;
    },

    getListing(shareId) {
      const d = db.prepare(
        "SELECT d.*, w.name AS ws_name, (SELECT count(*) FROM cards c WHERE c.deck_id=d.id) AS card_count " +
        "FROM decks d JOIN workspaces w ON d.workspace_id=w.id WHERE d.share_id=? AND d.listed=1").get(shareId);
      if (!d) return null;
      return {
        shareId: d.share_id, title: d.title, language: d.language, description: d.description || "",
        cardCount: d.card_count, installs: d.installs || 0, creator: d.ws_name,
      };
    },

    // Clone a listed deck into `ws` as a fresh deck (new ids, reset SRS, not
    // shared/listed) and bump the source's install count. Returns null if the
    // deck isn't listed.
    installListing(shareId, ws, now = Date.now()) {
      const src = db.prepare("SELECT * FROM decks WHERE share_id=? AND listed=1").get(shareId);
      if (!src) return null;
      const srcCards = cardsOfDeck(src.id);
      const newId = nanoid(10);
      const insertCard = db.prepare("INSERT INTO cards (id,deck_id,position,front,back,notes,start_t,end_t,tags,cloze,srs) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
      const tx = db.transaction(() => {
        db.prepare("INSERT INTO decks (id,workspace_id,title,language,audio_url,created_at,share_id,listed,listed_at,description,installs) VALUES (?,?,?,?,?,?,NULL,0,NULL,'',0)")
          .run(newId, ws, src.title, src.language, src.audio_url, now);
        let pos = 0;
        for (const c of srcCards) {
          insertCard.run(nanoid(10), newId, pos++, c.front, c.back, c.notes, c.start_t, c.end_t, c.tags, c.cloze, JSON.stringify(freshSrs(now)));
        }
        db.prepare("UPDATE decks SET installs=installs+1 WHERE id=?").run(src.id);
      });
      tx();
      return { deckId: newId, title: src.title, cardCount: srcCards.length };
    },

    // --- stats / search ----------------------------------------------
    stats(ws, now = Date.now()) {
      const cards = db.prepare("SELECT c.srs FROM cards c JOIN decks d ON c.deck_id=d.id WHERE d.workspace_id=?").all(ws)
        .map((r) => ({ srs: JSON.parse(r.srs) }));
      const log = db.prepare("SELECT grade,at FROM review_log WHERE workspace_id=?").all(ws);
      return computeStats(log, cards, now);
    },

    searchCards(ws, query, limit = 50) {
      const q = (query ?? "").trim().toLowerCase();
      if (!q) return [];
      const rows = db.prepare(
        "SELECT c.*, d.title dtitle, d.language dlang FROM cards c JOIN decks d ON c.deck_id=d.id " +
        "WHERE d.workspace_id=? ORDER BY d.created_at, c.position").all(ws);
      const out = [];
      for (const r of rows) {
        const front = (r.front ?? "").toLowerCase();
        const back = (r.back ?? "").toLowerCase();
        const notes = (r.notes ?? "").toLowerCase();
        const field = front.includes(q) ? "front" : back.includes(q) ? "back" : notes.includes(q) ? "notes" : null;
        if (!field) continue;
        out.push({
          cardId: r.id, deckId: r.deck_id, deckTitle: r.dtitle, language: r.dlang,
          front: r.front, back: r.back, notes: r.notes, start: r.start_t, end: r.end_t, field,
        });
        if (out.length >= limit) break;
      }
      return out;
    },

    // --- push subscriptions ------------------------------------------
    addPushSubscription(ws, sub) {
      if (!sub?.endpoint) return { error: "invalid" };
      db.prepare("INSERT OR REPLACE INTO push_subs (endpoint,workspace_id,sub,created_at) VALUES (?,?,?,?)")
        .run(sub.endpoint, ws, JSON.stringify(sub), Date.now());
      return { ok: true };
    },
    listPushSubscriptions(ws) {
      return db.prepare("SELECT sub FROM push_subs WHERE workspace_id=?").all(ws).map((r) => JSON.parse(r.sub));
    },
    removePushSubscription(ws, endpoint) {
      db.prepare("DELETE FROM push_subs WHERE workspace_id=? AND endpoint=?").run(ws, endpoint);
    },

    // --- Agent Arena scorecards --------------------------------------
    // Published anonymously from the /arena demo, resolved globally by an
    // unguessable id (like share links). Simulated results — no auth.
    publishScorecard(card, now = Date.now()) {
      const id = nanoid(12);
      db.prepare("INSERT INTO arena_scorecards (id,task,agent_count,winner,winner_score,data,created_at) VALUES (?,?,?,?,?,?,?)")
        .run(id, card.task ?? null, card.agentCount ?? null, card.winner ?? null, card.winnerScore ?? null, JSON.stringify(card), now);
      // Trim to the newest 500 so the table can't grow without bound.
      db.prepare("DELETE FROM arena_scorecards WHERE id NOT IN (SELECT id FROM arena_scorecards ORDER BY created_at DESC LIMIT 500)").run();
      return { id, createdAt: now };
    },
    getScorecard(id) {
      const r = db.prepare("SELECT data, created_at FROM arena_scorecards WHERE id=?").get(id);
      if (!r) return null;
      return { ...JSON.parse(r.data), id, createdAt: r.created_at };
    },
    listScorecards({ limit = 12, q = "", task = "" } = {}) {
      const where = [];
      const params = [];
      if (task) { where.push("task = ?"); params.push(task); }
      if (q.trim()) { where.push("(task LIKE ? OR winner LIKE ?)"); params.push(`%${q.trim()}%`, `%${q.trim()}%`); }
      const sql = `SELECT id,task,agent_count,winner,winner_score,data,created_at FROM arena_scorecards${
        where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ?`;
      return db.prepare(sql).all(...params, limit).map((r) => {
        let taskEmoji;
        try { taskEmoji = JSON.parse(r.data).taskEmoji; } catch { /* ignore */ }
        return {
          id: r.id, task: r.task, taskEmoji, agentCount: r.agent_count,
          winner: r.winner, winnerScore: r.winner_score, createdAt: r.created_at,
        };
      });
    },
    // Aggregate model ranking across every published scorecard (optionally one
    // task): appearances, wins, and average score per model.
    arenaLeaderboard({ task = "" } = {}) {
      const rows = db.prepare(`SELECT task, winner, data FROM arena_scorecards${task ? " WHERE task = ?" : ""}`)
        .all(...(task ? [task] : []));
      const models = new Map();
      const tasks = new Map();
      for (const row of rows) {
        tasks.set(row.task, (tasks.get(row.task) || 0) + 1);
        let results = [];
        try { results = JSON.parse(row.data).results || []; } catch { /* ignore */ }
        for (const r of results) {
          const m = models.get(r.name) || { name: r.name, provider: r.provider, color: r.color, appearances: 0, wins: 0, sumScore: 0 };
          m.appearances += 1;
          m.sumScore += r.totalScore || 0;
          if (r.name === row.winner) m.wins += 1;
          models.set(r.name, m);
        }
      }
      const ranked = [...models.values()]
        .map((m) => ({
          name: m.name, provider: m.provider, color: m.color,
          appearances: m.appearances, wins: m.wins,
          winRate: m.appearances ? Math.round((m.wins / m.appearances) * 100) : 0,
          avgScore: m.appearances ? Math.round(m.sumScore / m.appearances) : 0,
        }))
        .sort((a, b) => b.avgScore - a.avgScore || b.appearances - a.appearances);
      return {
        totalScorecards: rows.length,
        models: ranked,
        tasks: [...tasks.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      };
    },

    _db: () => db,
    close: () => db.close(),
  };

  // One-time import from an existing JSON store, so upgrading doesn't lose data.
  if (migrateFrom && existsSync(migrateFrom) && db.prepare("SELECT count(*) n FROM workspaces").get().n === 0) {
    importJson(db, JSON.parse(readFileSync(migrateFrom, "utf8")));
  }

  return api;
}

function importJson(db, data) {
  const tx = db.transaction(() => {
    for (const u of Object.values(data.users ?? {})) {
      db.prepare("INSERT OR IGNORE INTO users (id,email,salt,hash,keychain,created_at) VALUES (?,?,?,?,?,?)")
        .run(u.id, u.email, u.salt, u.hash, JSON.stringify(u.keychain ?? []), u.createdAt ?? Date.now());
    }
    for (const [token, s] of Object.entries(data.sessions ?? {})) {
      db.prepare("INSERT OR IGNORE INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)")
        .run(token, s.userId, s.createdAt ?? Date.now(), s.expiresAt);
    }
    for (const [th, r] of Object.entries(data.resets ?? {})) {
      db.prepare("INSERT OR IGNORE INTO resets (token_hash,user_id,expires_at) VALUES (?,?,?)").run(th, r.userId, r.expiresAt);
    }
    for (const w of Object.values(data.workspaces ?? {})) {
      db.prepare("INSERT OR IGNORE INTO workspaces (id,name,created_at,plan,billing) VALUES (?,?,?,?,?)")
        .run(w.id, w.name, w.createdAt ?? Date.now(), w.plan ?? "free", w.billing ? JSON.stringify(w.billing) : null);
      for (const m of w.members ?? []) {
        db.prepare("INSERT OR IGNORE INTO members (key,id,workspace_id,name,role,created_at) VALUES (?,?,?,?,?,?)")
          .run(m.key, m.id, w.id, m.name, m.role, m.createdAt ?? Date.now());
      }
    }
    for (const d of Object.values(data.decks ?? {})) {
      db.prepare("INSERT OR IGNORE INTO decks (id,workspace_id,title,language,audio_url,created_at,share_id) VALUES (?,?,?,?,?,?,?)")
        .run(d.id, d.workspaceId, d.title, d.language, d.audioUrl ?? null, d.createdAt ?? Date.now(), d.shareId ?? null);
      let pos = 0;
      for (const cid of d.cardOrder ?? []) {
        const c = data.cards?.[cid];
        if (!c) continue;
        db.prepare("INSERT OR IGNORE INTO cards (id,deck_id,position,front,back,notes,start_t,end_t,tags,cloze,srs) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
          .run(c.id, d.id, pos++, c.front, c.back, c.notes, c.start, c.end, JSON.stringify(c.tags ?? []), c.cloze ?? null, JSON.stringify(c.srs));
      }
    }
    for (const ev of data.reviewLog ?? []) {
      db.prepare("INSERT INTO review_log (workspace_id,deck_id,card_id,grade,at) VALUES (?,?,?,?,?)")
        .run(ev.workspaceId ?? null, ev.deckId ?? null, ev.cardId ?? null, ev.grade, ev.at);
    }
  });
  tx();
}
