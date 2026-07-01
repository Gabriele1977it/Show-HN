import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, newToken, normalizeEmail } from "../server/auth.js";

test("hashPassword + verifyPassword round-trip", () => {
  const { salt, hash } = hashPassword("correct horse");
  assert.ok(salt && hash);
  assert.equal(verifyPassword("correct horse", salt, hash), true);
  assert.equal(verifyPassword("wrong", salt, hash), false);
});

test("same password with different salts yields different hashes", () => {
  const a = hashPassword("pw");
  const b = hashPassword("pw");
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
  assert.equal(verifyPassword("pw", a.salt, a.hash), true);
});

test("verifyPassword is safe against missing inputs", () => {
  assert.equal(verifyPassword("x", null, null), false);
  assert.equal(verifyPassword("x", "salt", ""), false);
});

test("newToken returns distinct opaque tokens", () => {
  const a = newToken();
  const b = newToken();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{48}$/);
});

test("normalizeEmail lowercases and validates", () => {
  assert.equal(normalizeEmail("  Me@Example.COM "), "me@example.com");
  assert.equal(normalizeEmail("nope"), null);
  assert.equal(normalizeEmail("a@b"), null);
  assert.equal(normalizeEmail(""), null);
});
