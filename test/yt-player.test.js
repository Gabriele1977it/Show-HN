import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYouTubeRef, embedUrl, command } from "../public/yt-player.js";

test("parseYouTubeRef accepts the stored youtube:<id> form and pasted URLs", () => {
  assert.equal(parseYouTubeRef("youtube:dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(parseYouTubeRef("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1s"), "dQw4w9WgXcQ");
  assert.equal(parseYouTubeRef("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(parseYouTubeRef("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("parseYouTubeRef returns null for plain audio URLs and junk", () => {
  assert.equal(parseYouTubeRef("/uploads/abc123.mp3"), null);
  assert.equal(parseYouTubeRef("https://cdn.example.com/lesson.mp3"), null);
  assert.equal(parseYouTubeRef("youtube:notanid"), null);
  assert.equal(parseYouTubeRef(""), null);
  assert.equal(parseYouTubeRef(null), null);
});

test("embedUrl uses the privacy-enhanced host with the JS API enabled", () => {
  const u = new URL(embedUrl("dQw4w9WgXcQ", "https://echodeck.madlabs.uk"));
  assert.equal(u.hostname, "www.youtube-nocookie.com");
  assert.equal(u.pathname, "/embed/dQw4w9WgXcQ");
  assert.equal(u.searchParams.get("enablejsapi"), "1");
  assert.equal(u.searchParams.get("origin"), "https://echodeck.madlabs.uk");
});

test("command builds the iframe API postMessage payload", () => {
  assert.deepEqual(JSON.parse(command("seekTo", [12.5, true])), { event: "command", func: "seekTo", args: [12.5, true] });
  assert.deepEqual(JSON.parse(command("playVideo")), { event: "command", func: "playVideo", args: [] });
});
