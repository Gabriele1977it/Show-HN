import { test } from "node:test";
import assert from "node:assert/strict";
import { getArenaPlan, arenaPlanPublic, listArenaPlans, taskLimit, ARENA_PAID_PLANS } from "../server/arena-plans.js";
import { createStore } from "../server/store.js";
import { createSqliteStore } from "../server/store-sqlite.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("plan entitlements ladder up", () => {
  const free = getArenaPlan("free"), pro = getArenaPlan("pro"), ult = getArenaPlan("ultimate");
  assert.equal(free.maxModels, 2);
  assert.equal(pro.maxModels, 6);
  assert.equal(ult.maxModels, 12);
  assert.equal(free.realRuns, false);
  assert.equal(pro.realRuns, true);
  assert.equal(free.customTasks, false);
  assert.equal(pro.customTasks, false);
  assert.equal(ult.customTasks, true);
  assert.ok(pro.monthlyCredits > 0 && ult.monthlyCredits > pro.monthlyCredits);
});

test("taskLimit: starter caps at 3, all = everything; unknown → free", () => {
  assert.equal(taskLimit("free", 10), 3);
  assert.equal(taskLimit("pro", 10), 10);
  assert.equal(taskLimit("ultimate", 10), 10);
  assert.equal(taskLimit("bogus", 10), 3);
});

test("public serialisation maps Infinity → null and includes prices", () => {
  const ult = arenaPlanPublic("ultimate");
  assert.equal(ult.runsPerDay, null); // Infinity → null
  assert.equal(ult.price, 49);
  const pub = listArenaPlans();
  assert.deepEqual(pub.map((p) => p.id), ["free", "pro", "ultimate"]);
  assert.deepEqual(ARENA_PAID_PLANS, ["pro", "ultimate"]);
});

for (const kind of ["json", "sqlite"]) {
  test(`account plan persists + resets (${kind} store)`, () => {
    const tmp = mkdtempSync(join(tmpdir(), "arena-plan-"));
    const store = kind === "sqlite" ? createSqliteStore(join(tmp, "s.db")) : createStore(join(tmp, "s.json"));
    try {
      const u = store.createUser({ email: "sub@example.com", password: "secret1" });
      assert.equal(store.getArenaAccountPlan(u.id).plan, "free");
      store.setArenaAccountPlan(u.id, "pro", { provider: "stripe", status: "active" });
      const got = store.getArenaAccountPlan(u.id);
      assert.equal(got.plan, "pro");
      assert.equal(got.billing.status, "active");
      store.setArenaAccountPlan(u.id, "free", { provider: "stripe", status: "canceled" });
      assert.equal(store.getArenaAccountPlan(u.id).plan, "free");
      assert.deepEqual(store.setArenaAccountPlan("nope", "pro"), { error: "not-found" });
    } finally {
      store.close?.();
      rmSync(tmp, { recursive: true, force: true });
    }
  });
}
