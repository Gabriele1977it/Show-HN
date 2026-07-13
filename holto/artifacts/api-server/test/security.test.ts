import assert from "node:assert/strict";
import type { NextFunction, Request, Response } from "express";
import { test } from "node:test";

import { requireAuth, signToken } from "../src/middlewares/auth";
import { rateLimit } from "../src/lib/rate-limit";

// Minimal Express req/res doubles for middleware unit tests.
function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}
function run(mw: (req: Request, res: Response, next: NextFunction) => void, req: Partial<Request>) {
  const res = mockRes();
  let nextCalled = false;
  mw(req as Request, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

// ── requireAuth ──────────────────────────────────────────────────────────────

test("requireAuth rejects a missing Authorization header with 401", () => {
  const { res, nextCalled } = run(requireAuth, { headers: {} });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("requireAuth rejects a malformed / non-Bearer header with 401", () => {
  const { res, nextCalled } = run(requireAuth, { headers: { authorization: "Basic abc" } });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("requireAuth rejects a garbage bearer token with 401", () => {
  const { res, nextCalled } = run(requireAuth, { headers: { authorization: "Bearer not.a.jwt" } });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("requireAuth accepts a valid signed token and populates req.auth", () => {
  const token = signToken({ userId: 42, email: "traveller@example.com" });
  const req = { headers: { authorization: `Bearer ${token}` } } as Partial<Request>;
  const { nextCalled } = run(requireAuth, req);
  assert.equal(nextCalled, true);
  assert.equal((req as Request).auth?.userId, 42);
  assert.equal((req as Request).auth?.email, "traveller@example.com");
});

// ── requireOwner ─────────────────────────────────────────────────────────────
// OWNER_EMAILS is read once at module load, so set it before the dynamic import.
// The owner middleware transitively loads the db module, which only requires a
// DATABASE_URL string to be present (the pool connects lazily — no real DB).
process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/test";

test("requireOwner returns 404 to a non-owner (surface stays hidden)", async () => {
  process.env.OWNER_EMAILS = "boss@holto.test";
  const { requireOwner } = await import("../src/middlewares/owner");
  const { res, nextCalled } = run(requireOwner, { auth: { userId: 1, email: "random@example.com" } });
  assert.equal(res.statusCode, 404);
  assert.equal(nextCalled, false);
});

test("requireOwner returns 404 when there is no auth at all", async () => {
  const { requireOwner } = await import("../src/middlewares/owner");
  const { res, nextCalled } = run(requireOwner, {});
  assert.equal(res.statusCode, 404);
  assert.equal(nextCalled, false);
});

test("requireOwner allows a configured owner (case-insensitive)", async () => {
  process.env.OWNER_EMAILS = "boss@holto.test";
  const { requireOwner } = await import("../src/middlewares/owner");
  const { nextCalled } = run(requireOwner, { auth: { userId: 1, email: "BOSS@holto.test" } });
  assert.equal(nextCalled, true);
});

// ── rateLimit ────────────────────────────────────────────────────────────────

test("rateLimit allows up to max then blocks within the window", () => {
  const key = `test-${Math.random()}`;
  assert.equal(rateLimit(key, 3, 60_000), true);
  assert.equal(rateLimit(key, 3, 60_000), true);
  assert.equal(rateLimit(key, 3, 60_000), true);
  assert.equal(rateLimit(key, 3, 60_000), false); // 4th within window is denied
});

test("rateLimit keys are independent", () => {
  const a = `a-${Math.random()}`;
  const b = `b-${Math.random()}`;
  assert.equal(rateLimit(a, 1, 60_000), true);
  assert.equal(rateLimit(a, 1, 60_000), false);
  assert.equal(rateLimit(b, 1, 60_000), true); // different key unaffected
});
