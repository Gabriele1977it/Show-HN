// Password hashing and session tokens.
//
// Self-contained, no external deps: scrypt for password hashing (per-user salt)
// and a random token for sessions. Comparison is constant-time.

import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const KEYLEN = 32;

/** Hash a password with a fresh (or supplied) salt. */
export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(String(password), salt, KEYLEN).toString("hex");
  return { salt, hash };
}

/** Constant-time verify of a password against a stored salt+hash. */
export function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const candidate = scryptSync(String(password), salt, KEYLEN);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** Opaque random session token. */
export function newToken() {
  return randomBytes(24).toString("hex");
}

/** Light email sanity check (not RFC-perfect, just enough to reject junk). */
export function normalizeEmail(email) {
  const e = String(email ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}
