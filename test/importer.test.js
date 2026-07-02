import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseYouTubeId, isYouTube, guardUrl,
  timedTextJson3ToTranscript, timedTextXmlToTranscript,
  extractCaptionTracks, pickTrack, createImporter,
} from "../server/importer.js";

test("parseYouTubeId handles the common URL shapes", () => {
  assert.equal(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=10"), "dQw4w9WgXcQ");
  assert.equal(parseYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(parseYouTubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=x"), "dQw4w9WgXcQ");
  assert.equal(parseYouTubeId("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(parseYouTubeId("not a url"), null);
  assert.equal(isYouTube("https://youtu.be/dQw4w9WgXcQ"), true);
});

test("guardUrl blocks non-http and private/loopback/metadata hosts (SSRF)", () => {
  assert.throws(() => guardUrl("file:///etc/passwd"), /http/);
  assert.throws(() => guardUrl("http://localhost:3000/x"), /allowed/);
  assert.throws(() => guardUrl("http://127.0.0.1/x"), /allowed/);
  assert.throws(() => guardUrl("http://169.254.169.254/latest/meta-data"), /allowed/);
  assert.throws(() => guardUrl("http://10.0.0.5/x"), /allowed/);
  assert.throws(() => guardUrl("http://192.168.1.1/x"), /allowed/);
  assert.throws(() => guardUrl("http://[::1]/x"), /allowed/);
  // A normal public URL is fine.
  assert.equal(guardUrl("https://www.youtube.com/watch?v=abc").hostname, "www.youtube.com");
});

test("timedText parsers produce [mm:ss] lines segment.js understands", () => {
  const json = { events: [
    { tStartMs: 0, segs: [{ utf8: "Hello " }, { utf8: "world" }] },
    { tStartMs: 65000, segs: [{ utf8: "one minute in" }] },
    { tStartMs: 70000, segs: [{ utf8: "\n" }] }, // whitespace-only → skipped
  ] };
  assert.equal(timedTextJson3ToTranscript(json), "[00:00] Hello world\n[01:05] one minute in");

  const xml = `<transcript><text start="0" dur="2">Hi &amp; bye</text><text start="3.5" dur="1">Second</text></transcript>`;
  assert.equal(timedTextXmlToTranscript(xml), "[00:00] Hi & bye\n[00:03] Second");
});

test("extractCaptionTracks + pickTrack read the watch-page JSON", () => {
  const html = `<html>...{"captionTracks":[{"baseUrl":"https://yt/api/timedtext?v=1&lang=en","languageCode":"en","kind":"asr"},{"baseUrl":"https://yt/api/timedtext?v=1&lang=es","languageCode":"es"}],"audioTracks":[]}...` +
    `"videoDetails":{"videoId":"abc","title":"My \\u0041wesome Video"}...</html>`;
  const { tracks, title } = extractCaptionTracks(html);
  assert.equal(tracks.length, 2);
  assert.equal(title, "My Awesome Video");
  // Prefer requested language...
  assert.equal(pickTrack(tracks, "es").languageCode, "es");
  // ...else prefer a human (non-asr) track over the auto-generated one.
  assert.equal(pickTrack(tracks).languageCode, "es");
});

test("createImporter.run pulls YouTube captions via an injected fetch", async () => {
  const html = `x{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=vid","languageCode":"en"}]}y"videoDetails":{"title":"Demo"}z`;
  const json3 = JSON.stringify({ events: [{ tStartMs: 0, segs: [{ utf8: "First line" }] }, { tStartMs: 4000, segs: [{ utf8: "Second line" }] }] });
  const fetchImpl = async (url) => ({
    ok: true,
    text: async () => (url.includes("/api/timedtext") ? json3 : html),
  });
  const importer = createImporter({ fetchImpl });
  const r = await importer.run("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(r.source, "youtube");
  assert.equal(r.title, "Demo");
  assert.equal(r.language, "en");
  assert.match(r.transcript, /\[00:00\] First line/);
  assert.match(r.transcript, /\[00:04\] Second line/);
});

test("createImporter.run imports a direct .vtt URL but rejects arbitrary HTML pages", async () => {
  const vtt = "WEBVTT\n\n00:00.000 --> 00:02.000\nHola mundo\n";
  const fetchImpl = async (url) => ({
    ok: true,
    text: async () => (url.endsWith(".vtt") ? vtt : "<!doctype html><html><body>nope</body></html>"),
  });
  const importer = createImporter({ fetchImpl });
  const ok = await importer.run("https://example.com/subs/lesson.vtt");
  assert.equal(ok.source, "url");
  assert.match(ok.transcript, /Hola mundo/);

  const page = await importer.run("https://example.com/article.html");
  assert.equal(page.error, "unsupported-page");
});

test("createImporter.run returns a blocked error for private hosts, never throwing", async () => {
  const importer = createImporter({ fetchImpl: async () => { throw new Error("should not be called"); } });
  const r = await importer.run("http://169.254.169.254/latest/meta-data/");
  assert.equal(r.error, "blocked");
});
