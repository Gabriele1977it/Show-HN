import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCloze, suggestCloze } from "../server/cloze.js";

const BLANK = "＿＿＿";

test("applyCloze masks the first occurrence and returns the answer", () => {
  assert.deepEqual(applyCloze("今日は天気です", "天気"), { masked: `今日は${BLANK}です`, answer: "天気" });
  assert.equal(applyCloze("ab ab", "ab").masked, `${BLANK} ab`);
});

test("applyCloze returns null when the term is absent or inputs missing", () => {
  assert.equal(applyCloze("hello world", "xyz"), null);
  assert.equal(applyCloze("", "x"), null);
  assert.equal(applyCloze("text", ""), null);
});

test("suggestCloze picks the longest word in space-delimited text", () => {
  assert.equal(suggestCloze("the quick brown fox"), "quick"); // first of the length-5 words
  assert.equal(suggestCloze("I am happy"), "happy");
  assert.equal(suggestCloze("Hello, world!"), "Hello"); // punctuation stripped
});

test("suggestCloze prefers the longest kanji run for CJK text", () => {
  assert.equal(suggestCloze("週末は雨が降るかもしれません"), "週末"); // only kanji run of length 2
  assert.equal(suggestCloze("今日は天気がいいです"), "今日"); // ties -> first
});

test("suggestCloze falls back to kana runs, and is null when nothing fits", () => {
  assert.equal(suggestCloze("これはともだち"), "これはともだち"); // one long kana run
  assert.equal(suggestCloze(""), null);
  assert.equal(suggestCloze("   "), null);
});

test("a suggested term actually masks its source sentence", () => {
  const text = "週末は雨が降るかもしれません";
  const term = suggestCloze(text);
  const c = applyCloze(text, term);
  assert.ok(c && c.masked.includes(BLANK) && c.answer === term);
});
