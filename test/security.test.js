import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter, rateLimit, securityHeaders } from "../server/security.js";

test("rate limiter allows up to max, then blocks, and resets after the window", () => {
  const take = createRateLimiter({ windowMs: 1000, max: 2 });
  assert.equal(take("a", 0).allowed, true);
  assert.equal(take("a", 0).allowed, true);
  assert.equal(take("a", 0).allowed, false); // 3rd in window blocked
  assert.equal(take("b", 0).allowed, true); // independent key
  assert.equal(take("a", 1000).allowed, true); // window elapsed -> reset
});

function fakeRes() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

test("rateLimit middleware 429s once the limit is exceeded", () => {
  const mw = rateLimit(createRateLimiter({ windowMs: 1000, max: 1 }), () => "k");
  let nexted = 0;
  const next = () => nexted++;

  const r1 = fakeRes();
  mw({}, r1, next);
  assert.equal(nexted, 1);

  const r2 = fakeRes();
  mw({}, r2, next);
  assert.equal(nexted, 1); // next not called again
  assert.equal(r2.statusCode, 429);
  assert.match(r2.body.error, /Too many/);
  assert.ok(r2.headers["retry-after"]);
});

test("securityHeaders sets hardening headers including a CSP", () => {
  const res = fakeRes();
  let called = false;
  securityHeaders({}, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["x-frame-options"], "SAMEORIGIN");
  assert.match(res.headers["content-security-policy"], /default-src 'self'/);
  assert.match(res.headers["content-security-policy"], /checkout\.stripe\.com/);
});
