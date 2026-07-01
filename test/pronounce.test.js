import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, scoreAttempt } from "../server/pronounce.js";

test("tokenize splits latin into words and CJK into characters", () => {
  assert.deepEqual(tokenize("Hello, world!"), ["hello", "world"]);
  assert.deepEqual(tokenize("こんにちは"), ["こ", "ん", "に", "ち", "は"]);
  // Mixed: latin word kept whole, CJK per-char.
  assert.deepEqual(tokenize("NHK ニュース"), ["nhk", "ニ", "ュ", "ー", "ス"]);
});

test("a perfect match scores 100 and suggests 'easy'", () => {
  const r = scoreAttempt("the quick brown fox", "The quick brown fox.");
  assert.equal(r.score, 100);
  assert.equal(r.matched, 4);
  assert.equal(r.total, 4);
  assert.equal(r.suggestedGrade, "easy");
  assert.deepEqual(r.missed, []);
  assert.ok(r.words.every((w) => w.ok));
});

test("partial matches score proportionally and flag missed words", () => {
  const r = scoreAttempt("the quick brown fox", "the brown dog");
  // Matched in order: "the", "brown" → 2 of 4 = 50.
  assert.equal(r.matched, 2);
  assert.equal(r.total, 4);
  assert.equal(r.score, 50);
  assert.equal(r.suggestedGrade, "hard");
  assert.deepEqual(r.missed, ["quick", "fox"]);
  assert.deepEqual(r.extra, ["dog"]);
  const okMap = Object.fromEntries(r.words.map((w) => [w.token, w.ok]));
  assert.equal(okMap.the, true);
  assert.equal(okMap.quick, false);
});

test("order matters: LCS aligns in sequence", () => {
  // "brown quick" only matches one of the two (subsequence), not both.
  const r = scoreAttempt("the quick brown fox", "the brown quick fox");
  assert.equal(r.total, 4);
  // the, (quick|brown), fox → 3 matched.
  assert.equal(r.matched, 3);
  assert.equal(r.score, 75);
  assert.equal(r.suggestedGrade, "good");
});

test("empty attempt scores 0 and suggests 'again'", () => {
  const r = scoreAttempt("hola gracias", "");
  assert.equal(r.score, 0);
  assert.equal(r.suggestedGrade, "again");
  assert.equal(r.empty, true);
  assert.deepEqual(r.missed, ["hola", "gracias"]);
});

test("empty target is handled without dividing by zero", () => {
  const r = scoreAttempt("", "anything");
  assert.equal(r.score, 0);
  assert.equal(r.total, 0);
  assert.equal(r.empty, true);
});

test("CJK is scored per character", () => {
  const r = scoreAttempt("こんにちは", "こんにちわ"); // last char wrong
  assert.equal(r.total, 5);
  assert.equal(r.matched, 4);
  assert.equal(r.score, 80);
  assert.equal(r.suggestedGrade, "good");
});
