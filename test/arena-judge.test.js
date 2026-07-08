import { test } from "node:test";
import assert from "node:assert/strict";
import { createArenaJudge } from "../server/arena-judge.js";

test("judge is disabled with no adapter", async () => {
  const j = createArenaJudge({});
  assert.equal(j.enabled, false);
  assert.equal(await j.score({ task: "t", prompt: "p", output: "o" }), null);
});

test("judge scores an output, clamps to 0–100, derives overall", async () => {
  const j = createArenaJudge({
    judge: async ({ output }) => ({ accuracy: 130, relevance: 70, promptTokens: 40, completionTokens: 12, seen: output }),
  });
  assert.equal(j.enabled, true);
  const sc = await j.score({ task: "Draft email", prompt: "write it", output: "Subject: hi" });
  assert.equal(sc.accuracy, 100);       // clamped
  assert.equal(sc.relevance, 70);
  assert.equal(sc.overall, 85);          // (100+70)/2
  assert.equal(sc.promptTokens, 40);
  assert.equal(sc.completionTokens, 12);
});

test("judge returns null on empty output or a thrown adapter", async () => {
  const throwing = createArenaJudge({ judge: async () => { throw new Error("429"); } });
  assert.equal(await throwing.score({ output: "x" }), null);
  const ok = createArenaJudge({ judge: async () => ({ accuracy: 80, relevance: 80, overall: 80 }) });
  assert.equal(await ok.score({ output: "   " }), null); // empty output → skip
});
