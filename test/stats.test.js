import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, dayKey, DAY } from "../server/stats.js";

const NOW = Date.parse("2026-06-15T12:00:00Z");
const card = (due) => ({ srs: { due } });

test("empty inputs give a well-formed zeroed dashboard", () => {
  const s = computeStats([], [], NOW);
  assert.equal(s.totalCards, 0);
  assert.equal(s.totalReviews, 0);
  assert.equal(s.reviewedToday, 0);
  assert.equal(s.retentionRate, null);
  assert.equal(s.streakDays, 0);
  assert.equal(s.daily.length, 14);
  assert.equal(s.forecast.length, 7);
  assert.equal(s.daily.at(-1).date, dayKey(NOW)); // today is last
});

test("daily buckets tally pass/fail by grade", () => {
  const log = [
    { grade: 5, at: NOW },              // today, pass
    { grade: 2, at: NOW },              // today, fail (Again)
    { grade: 4, at: NOW - DAY },        // yesterday, pass
  ];
  const s = computeStats(log, [], NOW);
  const today = s.daily.at(-1);
  const yday = s.daily.at(-2);
  assert.deepEqual([today.count, today.pass, today.fail], [2, 1, 1]);
  assert.deepEqual([yday.count, yday.pass, yday.fail], [1, 1, 0]);
  assert.equal(s.reviewedToday, 2);
  assert.equal(s.totalReviews, 3);
});

test("retention rate is the pass share over the window, rounded to a percent", () => {
  const log = [
    { grade: 4, at: NOW },
    { grade: 5, at: NOW },
    { grade: 2, at: NOW },
  ];
  assert.equal(computeStats(log, [], NOW).retentionRate, 67); // 2/3
});

test("streak counts consecutive days ending today and breaks on a gap", () => {
  const consec = computeStats(
    [{ grade: 4, at: NOW }, { grade: 4, at: NOW - DAY }, { grade: 4, at: NOW - 2 * DAY }],
    [], NOW,
  );
  assert.equal(consec.streakDays, 3);

  const gap = computeStats(
    [{ grade: 4, at: NOW }, { grade: 4, at: NOW - 2 * DAY }], // missed yesterday
    [], NOW,
  );
  assert.equal(gap.streakDays, 1);

  const idleToday = computeStats([{ grade: 4, at: NOW - DAY }], [], NOW);
  assert.equal(idleToday.streakDays, 0); // nothing today -> streak 0
});

test("forecast folds overdue cards into today and buckets the rest by day", () => {
  const cards = [
    card(NOW - DAY),      // overdue -> today
    card(NOW - 1000),     // due moments ago -> today
    card(NOW + DAY),      // tomorrow
    card(NOW + 3 * DAY),  // +3 days
    card(NOW + 30 * DAY), // beyond window -> ignored
  ];
  const s = computeStats([], cards, NOW);
  assert.equal(s.forecast[0].due, 2);
  assert.equal(s.forecast[1].due, 1);
  assert.equal(s.forecast[3].due, 1);
  assert.equal(s.forecast.reduce((n, d) => n + d.due, 0), 4); // 30-day card excluded
  assert.equal(s.totalCards, 5);
});
