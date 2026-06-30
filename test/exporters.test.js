import { test } from "node:test";
import assert from "node:assert/strict";
import { toAnkiTsv, toCsv, toJson, exportDeck } from "../server/exporters.js";

const cards = [
  { front: "こんにちは", back: "hello", notes: "greeting", start: 0, end: 4, tags: ["news"], srs: { reps: 1 } },
  { front: 'a, "quoted"', back: "with\nnewline", notes: "", start: null, end: null, tags: [] },
];

test("anki tsv has front/back/tags columns and no header", () => {
  const out = toAnkiTsv(cards);
  const lines = out.split("\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[0], "こんにちは\thello\tnews");
  assert.ok(!/front/.test(out));
});

test("anki tsv strips tabs and newlines from fields", () => {
  const out = toAnkiTsv(cards);
  assert.ok(!out.split("\n")[1].includes("\n with"));
  assert.equal(out.split("\n")[1].split("\t").length, 3);
});

test("csv escapes commas, quotes and newlines", () => {
  const out = toCsv(cards);
  // Embedded newlines live inside quoted fields, so assert on the whole blob
  // rather than splitting on "\n" (which would cut a field in half).
  assert.ok(out.startsWith("front,back,notes,start,end,tags\n"));
  assert.ok(out.includes('"a, ""quoted"""'));
  assert.ok(out.includes('"with\nnewline"'));
});

test("json export carries deck metadata and srs", () => {
  const json = JSON.parse(toJson({ title: "T", language: "JP", audioUrl: "/x.mp3" }, cards));
  assert.equal(json.title, "T");
  assert.equal(json.cards.length, 2);
  assert.equal(json.cards[0].srs.reps, 1);
});

test("exportDeck dispatches on format", () => {
  assert.equal(exportDeck({}, cards, "anki").ext, "tsv");
  assert.equal(exportDeck({}, cards, "csv").ext, "csv");
  assert.equal(exportDeck({}, cards, "json").ext, "json");
  assert.equal(exportDeck({}, cards, "weird").ext, "json"); // default
});
