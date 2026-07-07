import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRunCents, getPack, CREDIT_PACKS, creditsConfig } from "../server/arena-credits.js";
import { createStore } from "../server/store.js";
import { createSqliteStore } from "../server/store-sqlite.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const registry = {
  Anthropic: { color: "#d97757", models: [{ id: "claude-opus-4.5", costPer1k: 0.025 }] },
  OpenAI: { color: "#10a37f", models: [{ id: "gpt-5.1", costPer1k: 0.01 }] },
};

test("computeRunCents: only live models cost; markup + ceil-to-cent applied", () => {
  // 1000 tokens of claude-opus @ $0.025/1k = $0.025 = 2.5c; ×1.5 markup = 3.75c → ceil 4c.
  const results = [
    { id: "claude-opus-4.5", live: true, promptTokens: 600, completionTokens: 400 },
    { id: "gpt-5.1", live: false, promptTokens: 999, completionTokens: 999 },
  ];
  assert.equal(computeRunCents(results, registry, 1.5), 4);
  // Pass-through markup: 2.5c → ceil 3c.
  assert.equal(computeRunCents(results, registry, 1), 3);
  // A live run always costs at least 1 cent, even if tiny.
  assert.equal(computeRunCents([{ id: "claude-opus-4.5", live: true, promptTokens: 1, completionTokens: 0 }], registry, 1), 1);
  // No live models → free.
  assert.equal(computeRunCents([{ id: "gpt-5.1", live: false }], registry, 1.5), 0);
});

test("credit packs + config", () => {
  assert.equal(getPack("p5").cents, 500);
  assert.equal(getPack("nope"), null);
  assert.ok(CREDIT_PACKS.length >= 1);
  const cfg = creditsConfig({ ARENA_CREDIT_MARKUP: "2", ARENA_SIGNUP_BONUS_CENTS: "0" });
  assert.equal(cfg.markup, 2);
  assert.equal(cfg.signupBonusCents, 0);
});

for (const kind of ["json", "sqlite"]) {
  test(`wallet lifecycle (${kind} store): bonus, top-up, charge, stats`, () => {
    const tmp = mkdtempSync(join(tmpdir(), "arena-credits-"));
    const store = kind === "sqlite" ? createSqliteStore(join(tmp, "s.db")) : createStore(join(tmp, "s.json"));
    try {
      const u = store.createUser({ email: "buyer@example.com", password: "secret1" });

      // First read grants the signup bonus (idempotent thereafter).
      const w0 = store.getArenaWallet(u.id, { bonusCents: 25 });
      assert.equal(w0.credits, 25);
      assert.equal(store.getArenaWallet(u.id, { bonusCents: 25 }).credits, 25); // no double bonus

      // Top up 500c.
      assert.equal(store.addArenaCredits(u.id, 500, { provider: "dev" }).credits, 525);

      // Charge a run for 30c.
      const c = store.chargeArenaRun(u.id, 30, { task: "sales-email", tokens: 1200, models: ["claude-opus-4.5"] });
      assert.equal(c.charged, 30);
      assert.equal(c.credits, 495);

      // Charge more than balance → floored at 0, only what's left is taken.
      const c2 = store.chargeArenaRun(u.id, 10000, { task: "x", tokens: 5, models: ["m"] });
      assert.equal(c2.charged, 495);
      assert.equal(c2.credits, 0);

      const w = store.getArenaWallet(u.id);
      assert.equal(w.credits, 0);
      assert.equal(w.runs, 2);
      assert.equal(w.topupCents, 525);   // bonus + top-up
      assert.equal(w.spentCents, 525);   // 30 + 495

      const stats = store.arenaCreditsStats();
      assert.equal(stats.totalAccounts, 1);
      assert.equal(stats.totalTopupCents, 525);
      assert.equal(stats.totalSpentCents, 525);
      assert.equal(stats.totalRuns, 2);
      assert.equal(stats.outstandingCents, 0);
      assert.equal(stats.accounts[0].email, "buyer@example.com");
      assert.ok(stats.recent.length >= 3);
      assert.ok(stats.recent.some((e) => e.kind === "run" && e.email === "buyer@example.com"));
    } finally {
      store.close?.();
      rmSync(tmp, { recursive: true, force: true });
    }
  });
}
