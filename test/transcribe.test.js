import { test } from "node:test";
import assert from "node:assert/strict";
import { createTranscriber, normalizeTranscript } from "../server/transcribe.js";

test("normalizeTranscript turns segments into bracket-timestamped lines", () => {
  const out = normalizeTranscript({ segments: [
    { start: 0, end: 4, text: " Hello " },
    { start: 65, end: 70, text: "world" },
    { start: 3661, end: 3665, text: "later" },
  ] });
  assert.equal(out.transcript, "[00:00] Hello\n[01:05] world\n[1:01:01] later");
  assert.equal(out.segments.length, 3);
});

test("normalizeTranscript passes plain text through and drops empty segments", () => {
  assert.deepEqual(normalizeTranscript({ text: "  just text  " }), { segments: [], transcript: "just text" });
  const out = normalizeTranscript({ segments: [{ start: 0, text: "" }, { start: 1, text: "keep" }] });
  assert.equal(out.transcript, "[00:01] keep");
});

test("transcriber is disabled with no webhook and no injected fn", async () => {
  const t = createTranscriber({});
  assert.equal(t.enabled, false);
  assert.deepEqual(await t.run("http://x/a.mp3"), { error: "not-configured" });
});

test("transcriber runs the injected function and normalizes its output", async () => {
  const seen = [];
  const t = createTranscriber({
    transcribe: async (audioUrl) => { seen.push(audioUrl); return { segments: [{ start: 2, end: 5, text: "hola" }] }; },
  });
  assert.equal(t.enabled, true);
  const out = await t.run("http://x/a.mp3");
  assert.equal(out.transcript, "[00:02] hola");
  assert.deepEqual(seen, ["http://x/a.mp3"]);
});

test("transcriber guards against a missing audio URL", async () => {
  const t = createTranscriber({ transcribe: async () => ({ text: "x" }) });
  assert.deepEqual(await t.run("   "), { error: "no-audio" });
});

test("transcriber posts to the webhook when configured", async () => {
  const calls = [];
  const t = createTranscriber({
    webhookUrl: "https://stt.example/transcribe",
    fetchImpl: async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: true, json: async () => ({ text: "from webhook" }) }; },
  });
  const out = await t.run("http://x/a.mp3");
  assert.equal(out.transcript, "from webhook");
  assert.equal(calls[0].url, "https://stt.example/transcribe");
  assert.deepEqual(calls[0].body, { audioUrl: "http://x/a.mp3" });
});
