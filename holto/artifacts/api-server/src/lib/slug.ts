import { randomBytes } from "node:crypto";

const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz"; // no 0/1/o/l — unambiguous in a link

// A short, unguessable, URL-safe slug for public trip pages. 10 chars of this
// 32-char alphabet ≈ 50 bits of entropy — plenty for non-enumerable share links.
export function makeSlug(len = 10): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}
