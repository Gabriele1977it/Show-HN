import { test } from "node:test";
import assert from "node:assert/strict";
import { freshSrs, review, isDue, DAY_MS } from "../server/srs.js";

test("fresh card is due immediately", () => {
  const now = 1000;
  const s = freshSrs(now);
  assert.equal(s.interval, 0);
  assert.equal(s.reps, 0);
  assert.ok(isDue(s, now));
});

test("good grades grow the interval 1 -> 6 -> ease*6", () => {
  const now = 0;
  let s = freshSrs(now);
  s = review(s, 4, now);
  assert.equal(s.interval, 1);
  assert.equal(s.due, now + DAY_MS);

  s = review(s, 4, now);
  assert.equal(s.interval, 6);

  s = review(s, 4, now);
  assert.equal(s.reps, 3);
  assert.equal(s.interval, Math.round(6 * s.ease));
});

test("a lapse (Again) resets reps and re-shows in ~10 minutes", () => {
  const now = 0;
  let s = freshSrs(now);
  s = review(s, 4, now);
  s = review(s, 4, now);
  const beforeEase = s.ease;
  s = review(s, 2, now); // Again
  assert.equal(s.reps, 0);
  assert.equal(s.interval, 0);
  assert.equal(s.due, now + 10 * 60 * 1000);
  assert.ok(s.ease < beforeEase);
});

test("ease never drops below 1.3", () => {
  let s = freshSrs(0);
  for (let i = 0; i < 20; i++) s = review(s, 0, 0);
  assert.ok(s.ease >= 1.3);
});

test("review is pure (does not mutate input)", () => {
  const s = freshSrs(0);
  const copy = { ...s };
  review(s, 5, 0);
  assert.deepEqual(s, copy);
});

test("isDue respects the due timestamp", () => {
  const s = review(freshSrs(0), 4, 0);
  assert.equal(isDue(s, DAY_MS - 1), false);
  assert.equal(isDue(s, DAY_MS), true);
});
