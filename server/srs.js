// Spaced-repetition scheduling (SM-2, lightly adapted).
//
// A card's review state is four numbers:
//   ease      multiplier applied to the interval (>= 1.3)
//   interval  days until the card is next due
//   reps      number of consecutive successful reviews
//   due       epoch milliseconds when the card becomes due
//
// Grades follow the classic 0-5 quality scale; the UI maps its buttons to:
//   Again = 2, Hard = 3, Good = 4, Easy = 5.

export const DAY_MS = 24 * 60 * 60 * 1000;

export function freshSrs(now = Date.now()) {
  return { ease: 2.5, interval: 0, reps: 0, due: now, lastGrade: null };
}

/**
 * Apply a review grade and return the updated SRS state.
 * Pure: does not mutate the input.
 * @param {{ease:number,interval:number,reps:number}} srs
 * @param {number} grade 0-5
 * @param {number} [now] epoch ms
 */
export function review(srs, grade, now = Date.now()) {
  const g = Math.max(0, Math.min(5, Math.round(grade)));
  let { ease, interval, reps } = srs;
  ease = ease ?? 2.5;

  if (g < 3) {
    // Lapse: reset progress, re-show soon (~10 minutes).
    reps = 0;
    interval = 0;
    const due = now + 10 * 60 * 1000;
    ease = Math.max(1.3, ease - 0.2);
    return { ease: round(ease), interval, reps, due, lastGrade: g };
  }

  reps += 1;
  if (reps === 1) interval = 1;
  else if (reps === 2) interval = 6;
  else interval = Math.round(interval * ease);

  // Standard SM-2 ease adjustment.
  ease = ease + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02));
  ease = Math.max(1.3, ease);

  return {
    ease: round(ease),
    interval,
    reps,
    due: now + interval * DAY_MS,
    lastGrade: g,
  };
}

/** Is this card due for review at `now`? */
export function isDue(srs, now = Date.now()) {
  return (srs?.due ?? 0) <= now;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
