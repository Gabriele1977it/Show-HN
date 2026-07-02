import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseYouTubeId, isYouTube, guardUrl,
  timedTextJson3ToTranscript, timedTextXmlToTranscript,
  extractCaptionTracks, captionTracksFromPlayer, supadataToTranscript, pickTrack, createImporter,
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

test("captionTracksFromPlayer reads the innertube player response", () => {
  const player = { captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: "u", languageCode: "fr" }] } }, videoDetails: { title: "T" } };
  const { tracks, title } = captionTracksFromPlayer(player);
  assert.equal(tracks.length, 1);
  assert.equal(title, "T");
  assert.deepEqual(captionTracksFromPlayer({}).tracks, []);
  assert.deepEqual(captionTracksFromPlayer(null).tracks, []);
});

test("supadataToTranscript builds [mm:ss] lines from offset-ms segments", () => {
  const data = { lang: "en", content: [{ text: "First line", offset: 0, duration: 2000 }, { text: "Second line ", offset: 65000 }, { text: "  ", offset: 70000 }] };
  assert.equal(supadataToTranscript(data), "[00:00] First line\n[01:05] Second line");
  assert.equal(supadataToTranscript({}), "");
});

test("with an apiKey, YouTube import goes through the Supadata API (not scraping)", async () => {
  const transcript = { lang: "en", content: [{ text: "Hola mundo", offset: 0 }, { text: "Segunda linea", offset: 4000 }] };
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.startsWith("https://api.supadata.ai/")) return { ok: true, json: async () => transcript };
    if (url.includes("/oembed")) return { ok: true, json: async () => ({ title: "Cairo trip" }) };
    throw new Error("should not scrape YouTube when an API key is set");
  };
  const importer = createImporter({ fetchImpl, apiKey: "sd_test" });
  const r = await importer.run("https://www.youtube.com/watch?v=EwFn5EM07i0", { lang: "es" });
  assert.equal(r.source, "youtube");
  assert.equal(r.title, "Cairo trip");
  assert.equal(r.language, "en");
  assert.match(r.transcript, /\[00:00\] Hola mundo/);
  assert.match(r.transcript, /\[00:04\] Segunda linea/);
  assert.ok(calls.some((u) => u.startsWith("https://api.supadata.ai/")), "the Supadata API was called");
});

test("a failing transcript API surfaces api-failed (no silent scrape)", async () => {
  const fetchImpl = async (url) => {
    if (url.startsWith("https://api.supadata.ai/")) return { ok: false, status: 401 };
    throw new Error("should not fall back to scraping");
  };
  const importer = createImporter({ fetchImpl, apiKey: "bad_key" });
  const r = await importer.run("https://youtu.be/EwFn5EM07i0");
  assert.equal(r.error, "api-failed");
  assert.match(r.message, /401/);
});

test("createImporter.run uses the YouTube player API first", async () => {
  const player = { captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: "https://www.youtube.com/api/timedtext?v=vid", languageCode: "en" }] } }, videoDetails: { title: "Innertube Demo" } };
  const json3 = JSON.stringify({ events: [{ tStartMs: 0, segs: [{ utf8: "First line" }] }] });
  const fetchImpl = async (url) => {
    if (url.includes("/youtubei/v1/player")) return { ok: true, json: async () => player };
    if (url.includes("/api/timedtext")) return { ok: true, text: async () => json3 };
    throw new Error("watch page should not be needed");
  };
  const r = await createImporter({ fetchImpl }).run("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(r.source, "youtube");
  assert.equal(r.title, "Innertube Demo");
  assert.match(r.transcript, /\[00:00\] First line/);
});

test("createImporter.run reports yt-blocked when YouTube refuses both paths", async () => {
  const importer = createImporter({ fetchImpl: async () => { throw new Error("403 from datacenter IP"); } });
  const r = await importer.run("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(r.error, "yt-blocked");
});

test("createImporter.run falls back to the watch page when the player API fails", async () => {
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
