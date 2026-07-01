// Study statistics.
//
// Aggregates the raw review log and current card schedule into the numbers the
// dashboard shows: daily activity, retention, study streak, and a forward-
// looking "due" forecast. Pure functions — easy to test, no I/O.

export const DAY = 86_400_000;

/** UTC calendar-day key (YYYY-MM-DD) for an epoch-ms timestamp. */
export function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * @param {Array<{grade:number, at:number}>} reviewLog
 * @param {Array<{srs:{due:number}}>} cards
 * @param {number} [now]
 * @param {{days?:number, forecastDays?:number}} [opts]
 */
export function computeStats(reviewLog, cards, now = Date.now(), opts = {}) {
  const days = opts.days ?? 14;
  const forecastDays = opts.forecastDays ?? 7;
  const todayKey = dayKey(now);

  // Daily activity buckets, oldest first.
  const daily = [];
  const byDay = Object.create(null);
  for (let i = days - 1; i >= 0; i--) {
    const bucket = { date: dayKey(now - i * DAY), count: 0, pass: 0, fail: 0 };
    byDay[bucket.date] = bucket;
    daily.push(bucket);
  }

  let reviewedToday = 0;
  let windowTotal = 0;
  let windowPass = 0;
  const windowStart = now - days * DAY;

  for (const ev of reviewLog) {
    const key = dayKey(ev.at);
    const passed = ev.grade >= 3; // Again(2) is the only failing grade
    const bucket = byDay[key];
    if (bucket) {
      bucket.count++;
      passed ? bucket.pass++ : bucket.fail++;
    }
    if (key === todayKey) reviewedToday++;
    if (ev.at >= windowStart) {
      windowTotal++;
      if (passed) windowPass++;
    }
  }

  // Study streak: consecutive days with >=1 review, counting back from today.
  let streakDays = 0;
  for (let i = 0; i < days; i++) {
    const bucket = byDay[dayKey(now - i * DAY)];
    if (bucket && bucket.count > 0) streakDays++;
    else break;
  }

  // Due forecast: how many cards come due over the next `forecastDays`.
  // Overdue cards are folded into today (index 0).
  const forecast = [];
  const fByDay = Object.create(null);
  for (let i = 0; i < forecastDays; i++) {
    const bucket = { date: dayKey(now + i * DAY), due: 0 };
    fByDay[bucket.date] = bucket;
    forecast.push(bucket);
  }
  for (const c of cards) {
    const due = c.srs?.due;
    if (due == null) continue;
    if (due <= now) {
      forecast[0].due++;
      continue;
    }
    const bucket = fByDay[dayKey(due)];
    if (bucket) bucket.due++; // beyond the window: ignored
  }

  return {
    generatedAt: now,
    totalCards: cards.length,
    totalReviews: reviewLog.length,
    reviewedToday,
    retentionRate: windowTotal ? Math.round((windowPass / windowTotal) * 100) : null,
    streakDays,
    daily,
    forecast,
  };
}
