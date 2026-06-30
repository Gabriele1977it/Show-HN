// Minimal .env loader (no dependency).
//
// Reads KEY=VALUE lines from a .env file in the project root and adds them to
// process.env *without* overriding variables already set in the shell — so an
// inline `FOO=bar npm start` still wins. Keeps secrets (Stripe keys, etc.) in
// one local, gitignored file instead of the shell history.

import { readFileSync, existsSync } from "node:fs";

/** Parse .env text into a plain object. Supports comments, blank lines, quotes. */
export function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Load a .env file into process.env (shell values take precedence). */
export function loadEnv(path) {
  if (!existsSync(path)) return {};
  const parsed = parseEnv(readFileSync(path, "utf8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return parsed;
}
