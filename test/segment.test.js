import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentTranscript, parseTimestamp } from "../server/segment.js";

test("parseTimestamp handles mm:ss and hh:mm:ss with fractions", () => {
  assert.equal(parseTimestamp("00:12"), 12);
  assert.equal(parseTimestamp("01:02"), 62);
  assert.equal(parseTimestamp("1:02:33"), 3753);
  assert.equal(parseTimestamp("00:12.5"), 12.5);
  assert.equal(parseTimestamp("bad"), null);
});

test("timestamped transcript derives end from next start", () => {
  const segs = segmentTranscript("[00:00] hello there\n[00:04] second line\n[00:09] third");
  assert.equal(segs.length, 3);
  assert.deepEqual(segs[0], { text: "hello there", start: 0, end: 4 });
  assert.deepEqual(segs[1], { text: "second line", start: 4, end: 9 });
  assert.equal(segs[2].end, null); // last has no successor
});

test("bare timestamps without brackets are recognised", () => {
  const segs = segmentTranscript("00:00 alpha\n00:05 beta");
  assert.equal(segs[0].start, 0);
  assert.equal(segs[1].start, 5);
  assert.equal(segs[0].end, 5);
});

test("continuation lines append to previous cue", () => {
  const segs = segmentTranscript("[00:00] line one\ncontinued\n[00:03] line two");
  assert.equal(segs.length, 2);
  assert.equal(segs[0].text, "line one continued");
});

test("plain text splits into sentences and packs to maxChars", () => {
  const segs = segmentTranscript("One. Two! Three? Four.", { maxChars: 10 });
  assert.ok(segs.length >= 2);
  for (const s of segs) {
    assert.equal(s.start, null);
    assert.ok(s.text.length <= 10 || /\S/.test(s.text));
  }
});

test("CJK punctuation splits sentences", () => {
  const segs = segmentTranscript("こんにちは。今日は晴れです。", { maxChars: 8 });
  assert.equal(segs.length, 2);
  assert.equal(segs[0].text, "こんにちは。");
});

test("SRT cues keep real start and end times (comma milliseconds)", () => {
  const srt = `1
00:00:01,000 --> 00:00:04,500
Hello there

2
00:00:05,000 --> 00:00:07,250
Second line`;
  const segs = segmentTranscript(srt);
  assert.equal(segs.length, 2);
  assert.deepEqual(segs[0], { text: "Hello there", start: 1, end: 4.5 });
  assert.deepEqual(segs[1], { text: "Second line", start: 5, end: 7.25 });
});

test("WebVTT header, NOTE blocks and cue settings are ignored", () => {
  const vtt = `WEBVTT

NOTE this is a comment

00:00.000 --> 00:03.000 align:start
first cue
wrapped line

00:03.500 --> 00:06.000
second cue`;
  const segs = segmentTranscript(vtt);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].text, "first cue wrapped line");
  assert.equal(segs[0].start, 0);
  assert.equal(segs[0].end, 3);
  assert.equal(segs[1].start, 3.5);
});

test("multi-line cue body is joined with spaces", () => {
  const segs = segmentTranscript("00:00:00,000 --> 00:00:02,000\nline a\nline b");
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "line a line b");
});

test("empty transcript yields no segments", () => {
  assert.deepEqual(segmentTranscript(""), []);
  assert.deepEqual(segmentTranscript("   \n  "), []);
});
