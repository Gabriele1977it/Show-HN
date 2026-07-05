import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../server/store.js";
import { createSqliteStore } from "../server/store-sqlite.js";
import { createApp } from "../server/app.js";
import { createBilling } from "../server/billing.js";
import { createMailer } from "../server/email.js";
import { createClerkAuth, frontendApiFromKey } from "../server/clerk.js";

// A publishable key encodes the frontend-API host in base64 (with a trailing $).
const HOST = "foo-bar-13.clerk.accounts.dev";
const PK = "pk_test_" + Buffer.from(`${HOST}$`).toString("base64");

test("frontendApiFromKey decodes the host from the publishable key", () => {
  assert.equal(frontendApiFromKey(PK), HOST);
  assert.equal(frontendApiFromKey("pk_test_not-base64!!"), null);
  assert.equal(frontendApiFromKey(""), null);
  assert.equal(frontendApiFromKey(null), null);
});

test("createClerkAuth is disabled unless both keys are present", () => {
  assert.equal(createClerkAuth().enabled, false);
  assert.equal(createClerkAuth({ publishableKey: PK }).enabled, false);
  assert.equal(createClerkAuth({ secretKey: "sk_test_x" }).enabled, false);
});

test("stores look up users by email without a password", () => {
  const tmp = mkdtempSync(join(tmpdir(), "echodeck-clerk-store-"));
  try {
    for (const store of [createStore(join(tmp, "db.json")), createSqliteStore(join(tmp, "echodeck.db"))]) {
      const created = store.createUser({ email: "Who@Example.com", password: "secret1" });
      assert.deepEqual(store.getUserByEmail("who@example.com"), { id: created.id, email: "who@example.com" });
      assert.equal(store.getUserByEmail("nobody@example.com"), null);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- HTTP: exchange a (fake) verified Clerk session for an app session ----

let tmp, store, servers = [], disabledBase, enabledBase;
// Maps a fake Clerk user id -> email, standing in for the Clerk backend API.
const clerkEmails = { user_alice: "alice@example.com", user_bob: "bob@example.com", user_noemail: null };
// The fake adapter reads the "Bearer <clerk user id>" the tests send, playing
// the role of clerkMiddleware verifying a session token.
const fakeClerk = {
  enabled: true,
  publishableKey: PK,
  frontendApiOrigin: `https://${HOST}`,
  middleware: (_req, _res, next) => next(),
  sessionUserId: (req) => (req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim() || null,
  fetchEmail: async (userId) => {
    if (!(userId in clerkEmails)) throw new Error("unknown user");
    return clerkEmails[userId];
  },
};

async function listen(app) {
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "echodeck-clerk-"));
  store = process.env.ECHODECK_TEST_STORE === "sqlite"
    ? createSqliteStore(join(tmp, "echodeck.db"))
    : createStore(join(tmp, "db.json"));
  const common = {
    store,
    uploadsDir: join(tmp, "uploads"),
    reminders: null,
    billing: createBilling({ store, config: {} }),
    mailer: createMailer({ log: () => {} }),
    ownerEmails: new Set(["bob@example.com"]),
  };
  disabledBase = await listen(createApp(common));
  enabledBase = await listen(createApp({ ...common, clerk: fakeClerk }));
});

after(() => {
  for (const s of servers) s.close();
  rmSync(tmp, { recursive: true, force: true });
});

test("GET /api/auth/clerk reports whether Clerk is configured", async () => {
  const off = await (await fetch(`${disabledBase}/api/auth/clerk`)).json();
  assert.deepEqual(off, { enabled: false, publishableKey: null });
  const on = await (await fetch(`${enabledBase}/api/auth/clerk`)).json();
  assert.deepEqual(on, { enabled: true, publishableKey: PK });
});

test("CSP admits the Clerk origin only when Clerk is enabled", async () => {
  const off = (await fetch(`${disabledBase}/health`)).headers.get("content-security-policy");
  assert.ok(!off.includes(HOST));
  const on = (await fetch(`${enabledBase}/health`)).headers.get("content-security-policy");
  assert.match(on, new RegExp(`script-src 'self' https://${HOST}`));
  assert.match(on, new RegExp(`connect-src 'self' https://${HOST}`));
});

test("session exchange is refused when Clerk is disabled or unauthenticated", async () => {
  const off = await fetch(`${disabledBase}/api/auth/clerk/session`, { method: "POST" });
  assert.equal(off.status, 503);
  const anon = await fetch(`${enabledBase}/api/auth/clerk/session`, { method: "POST" });
  assert.equal(anon.status, 401);
  const noEmail = await fetch(`${enabledBase}/api/auth/clerk/session`, {
    method: "POST", headers: { Authorization: "Bearer user_noemail" },
  });
  assert.equal(noEmail.status, 400);
  const unknown = await fetch(`${enabledBase}/api/auth/clerk/session`, {
    method: "POST", headers: { Authorization: "Bearer user_ghost" },
  });
  assert.equal(unknown.status, 502);
});

test("first Clerk sign-in creates an account + workspace and issues a session", async () => {
  const r = await fetch(`${enabledBase}/api/auth/clerk/session`, {
    method: "POST", headers: { Authorization: "Bearer user_alice" },
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.email, "alice@example.com");
  assert.ok(data.token);
  assert.ok(data.key, "first sign-in provisions a workspace key");
  assert.equal(data.account.keychain.length, 1);

  // The issued session works against the regular account endpoint.
  const acct = await fetch(`${enabledBase}/api/account`, { headers: { "X-Session": data.token } });
  assert.equal(acct.status, 200);
  assert.equal((await acct.json()).email, "alice@example.com");

  // A repeat exchange links to the same account instead of creating another.
  const again = await (await fetch(`${enabledBase}/api/auth/clerk/session`, {
    method: "POST", headers: { Authorization: "Bearer user_alice" },
  })).json();
  assert.equal(again.key, undefined, "no new workspace on repeat sign-in");
  assert.equal(again.account.keychain[0].workspaceId, data.account.keychain[0].workspaceId);
});

test("Clerk sign-in links to an existing password account by email", async () => {
  const existing = store.createUser({ email: "bob@example.com", password: "hunter22" });
  const r = await fetch(`${enabledBase}/api/auth/clerk/session`, {
    method: "POST", headers: { Authorization: "Bearer user_bob" },
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.key, undefined, "existing account keeps its workspaces");
  const acct = await fetch(`${enabledBase}/api/account`, { headers: { "X-Session": data.token } });
  assert.equal((await acct.json()).email, "bob@example.com");
  assert.equal(store.getUserByEmail("bob@example.com").id, existing.id);
});
