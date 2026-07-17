import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDsn, sentryEnabled, captureError } from "../src/lib/sentry.ts";

test("parseDsn builds the store URL and public key from a valid DSN", () => {
  const d = parseDsn("https://abc123@o456.ingest.sentry.io/789");
  assert.equal(d?.publicKey, "abc123");
  assert.equal(d?.storeUrl, "https://o456.ingest.sentry.io/api/789/store/");
});

test("parseDsn rejects malformed DSNs", () => {
  assert.equal(parseDsn("not a url"), null);
  assert.equal(parseDsn("https://o456.ingest.sentry.io/789"), null); // no public key
  assert.equal(parseDsn("https://abc123@o456.ingest.sentry.io/"), null); // no project id
});

test("captureError is a safe no-op when tracking is disabled", () => {
  assert.equal(sentryEnabled(), false); // no SENTRY_DSN in tests
  assert.doesNotThrow(() => captureError(new Error("boom"), { path: "/x" }));
});
