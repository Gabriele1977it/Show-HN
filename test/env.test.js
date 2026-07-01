import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv, loadEnv } from "../server/env.js";

test("parseEnv handles comments, blanks, quotes and '=' in values", () => {
  const parsed = parseEnv(`
# a comment
PORT=3100

STRIPE_SECRET_KEY="sk_test_123"
QUOTED='hello world'
URL=https://example.com/path?a=b
EMPTY=
  SPACED = trimmed
`);
  assert.equal(parsed.PORT, "3100");
  assert.equal(parsed.STRIPE_SECRET_KEY, "sk_test_123"); // quotes stripped
  assert.equal(parsed.QUOTED, "hello world");
  assert.equal(parsed.URL, "https://example.com/path?a=b"); // '=' kept in value
  assert.equal(parsed.EMPTY, "");
  assert.equal(parsed.SPACED, "trimmed");
  assert.ok(!("# a comment" in parsed));
});

test("loadEnv applies values but never overrides the shell", () => {
  const dir = mkdtempSync(join(tmpdir(), "echodeck-env-"));
  const file = join(dir, ".env");
  writeFileSync(file, "ECHO_NEW=fromfile\nECHO_EXISTING=fromfile\n");
  process.env.ECHO_EXISTING = "fromshell";
  try {
    loadEnv(file);
    assert.equal(process.env.ECHO_NEW, "fromfile");
    assert.equal(process.env.ECHO_EXISTING, "fromshell"); // shell wins
  } finally {
    delete process.env.ECHO_NEW;
    delete process.env.ECHO_EXISTING;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadEnv on a missing file is a no-op", () => {
  assert.deepEqual(loadEnv(join(tmpdir(), "definitely-not-here-xyz", ".env")), {});
});
