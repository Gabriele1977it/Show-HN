import { test } from "node:test";
import assert from "node:assert/strict";
import { eloUpdate, scoreForA, isValidVote, START_RATING } from "../server/arena-vote.js";
import { createStore } from "../server/store.js";
import { createSqliteStore } from "../server/store-sqlite.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("elo: winner gains, loser loses the same, symmetric at equal ratings", () => {
  const [a, b] = eloUpdate(1500, 1500, 1); // A wins
  assert.equal(Math.round(a), 1512); // +K/2 = +12
  assert.equal(Math.round(b), 1488);
  const [c, d] = eloUpdate(1500, 1500, 0.5); // tie → no change
  assert.equal(Math.round(c), 1500);
  assert.equal(Math.round(d), 1500);
});

test("elo: upset (low beats high) moves more than an expected win", () => {
  const [lowWinner] = eloUpdate(1400, 1600, 1); // underdog wins
  const [favWinner] = eloUpdate(1600, 1400, 1); // favourite wins
  assert.ok((lowWinner - 1400) > (favWinner - 1600));
});

test("scoreForA + isValidVote", () => {
  assert.equal(scoreForA("a"), 1);
  assert.equal(scoreForA("b"), 0);
  assert.equal(scoreForA("tie"), 0.5);
  assert.equal(scoreForA("bad"), 0.5);
  assert.ok(isValidVote("a") && isValidVote("tie") && !isValidVote("x"));
});

for (const kind of ["json", "sqlite"]) {
  test(`vote lifecycle (${kind} store): ratings, deltas, leaderboard`, () => {
    const tmp = mkdtempSync(join(tmpdir(), "arena-vote-"));
    const store = kind === "sqlite" ? createSqliteStore(join(tmp, "s.db")) : createStore(join(tmp, "s.json"));
    try {
      const gpt = { id: "gpt-5.1", name: "GPT-5.1", provider: "OpenAI", color: "#10a37f" };
      const claude = { id: "claude-opus-4.5", name: "Claude Opus 4.5", provider: "Anthropic", color: "#d97757" };

      // GPT wins the first duel.
      const r1 = store.recordArenaVote({ task: "Draft Sales Email", a: gpt, b: claude, winner: "a" });
      assert.equal(r1.a.rating, START_RATING + 12);
      assert.equal(r1.a.delta, 12);
      assert.equal(r1.b.rating, START_RATING - 12);
      assert.equal(r1.b.delta, -12);
      assert.equal(r1.totalVotes, 1);

      // A tie next (claude is now the underdog): ELO nudges the lower-rated
      // side up and the higher-rated side down by the same small amount.
      const r2 = store.recordArenaVote({ task: "Support Triage", a: claude, b: gpt, winner: "tie" });
      assert.ok(r2.a.delta > 0);           // underdog claude gains
      assert.ok(r2.b.delta < 0);           // favourite gpt slips
      assert.equal(r2.a.delta, -r2.b.delta); // symmetric

      const lb = store.arenaVoteLeaderboard({ limit: 10 });
      assert.equal(lb.totalVotes, 2);
      assert.equal(lb.totalModels, 2);
      assert.equal(lb.models[0].id, "gpt-5.1"); // still higher ELO
      assert.ok(lb.models[0].rating > START_RATING);
      assert.equal(lb.models[0].wins, 1);
      assert.equal(lb.models[0].ties, 1);
      assert.equal(lb.models[0].games, 2);
      assert.equal(lb.models[0].winRate, 50); // 1 win / 2 games
      assert.equal(lb.models[1].id, "claude-opus-4.5");
      assert.equal(lb.models[1].losses, 1);
      assert.equal(lb.models[1].ties, 1);

      // Invalid: same model on both sides.
      assert.deepEqual(store.recordArenaVote({ a: gpt, b: gpt, winner: "a" }), { error: "invalid" });
    } finally {
      store.close?.();
      rmSync(tmp, { recursive: true, force: true });
    }
  });
}
