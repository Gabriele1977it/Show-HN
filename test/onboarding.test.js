import { test } from "node:test";
import assert from "node:assert/strict";
import { onboardingSteps, onboardingProgress, nextStep, ONBOARDING_STEPS } from "../public/onboarding.js";

test("a brand-new workspace has nothing done and 'build' is next", () => {
  const steps = onboardingSteps({ decks: [], flags: {} });
  assert.equal(steps.length, ONBOARDING_STEPS.length);
  assert.ok(steps.every((s) => s.done === false));
  const prog = onboardingProgress(steps);
  assert.deepEqual({ done: prog.done, total: prog.total, complete: prog.complete, percent: prog.percent }, { done: 0, total: 4, complete: false, percent: 0 });
  assert.equal(nextStep(steps).id, "build");
});

test("building a deck completes 'build' and advances the next step", () => {
  const steps = onboardingSteps({ decks: [{ id: "d1" }], flags: {} });
  assert.equal(steps.find((s) => s.id === "build").done, true);
  assert.equal(nextStep(steps).id, "review");
  assert.equal(onboardingProgress(steps).percent, 25);
});

test("a shared deck completes 'share' regardless of order", () => {
  const steps = onboardingSteps({ decks: [{ id: "d1", shareId: "abc" }], flags: {} });
  assert.equal(steps.find((s) => s.id === "share").done, true);
});

test("client activation flags complete 'review' and 'shadow'", () => {
  const steps = onboardingSteps({ decks: [{ id: "d1" }], flags: { reviewed: true, shadowed: true } });
  assert.equal(steps.find((s) => s.id === "review").done, true);
  assert.equal(steps.find((s) => s.id === "shadow").done, true);
});

test("all steps done reports complete and no next step", () => {
  const steps = onboardingSteps({ decks: [{ id: "d1", shareId: "x" }], flags: { reviewed: true, shadowed: true } });
  const prog = onboardingProgress(steps);
  assert.equal(prog.complete, true);
  assert.equal(prog.percent, 100);
  assert.equal(nextStep(steps), null);
});
