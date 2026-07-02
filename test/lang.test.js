import { test } from "node:test";
import assert from "node:assert/strict";
import { bcp47, isoOf, nameOf } from "../public/lang.js";

test("bcp47 maps language names to speech-recognition tags", () => {
  assert.equal(bcp47("Japanese"), "ja-JP");
  assert.equal(bcp47("  english "), "en-US");
  assert.equal(bcp47("klingon"), "");
  assert.equal(bcp47(null), "");
});

test("isoOf converts names and passes codes through", () => {
  assert.equal(isoOf("English"), "en");
  assert.equal(isoOf("dutch"), "nl");
  assert.equal(isoOf("en"), "en");
  assert.equal(isoOf("en-US"), "en");
  assert.equal(isoOf("NL"), "nl");
  assert.equal(isoOf("klingon"), undefined); // unknown → omit, don't send junk
  assert.equal(isoOf(""), undefined);
});

test("nameOf renders codes as readable names, passing unknowns through", () => {
  assert.equal(nameOf("nl"), "Dutch");
  assert.equal(nameOf("en"), "English");
  assert.equal(nameOf("ja-JP"), "Japanese");
  assert.equal(nameOf("xx"), "xx");
  assert.equal(nameOf(""), "");
});
