// Agent Arena — blind-vote ELO.
//
// The "arena" mechanic (à la LMSYS Chatbot Arena): users see two model outputs
// on the same task, unlabeled, and pick the better one. Votes update a per-model
// ELO rating, producing a crowd-sourced leaderboard that's genuinely trustworthy
// — no simulated scores. Pure functions here; persistence lives in the store.

export const START_RATING = 1500;
export const K_FACTOR = 24;

export const VOTE_OUTCOMES = new Set(["a", "b", "tie", "bad"]);
export const isValidVote = (w) => VOTE_OUTCOMES.has(w);

// The score for side A given the outcome: win = 1, loss = 0, tie/bad = 0.5.
export function scoreForA(winner) {
  if (winner === "a") return 1;
  if (winner === "b") return 0;
  return 0.5; // tie or "both bad"
}

// Standard ELO. Returns the pair of new ratings [newA, newB].
export function eloUpdate(ratingA, ratingB, scoreA) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const newA = ratingA + K_FACTOR * (scoreA - expectedA);
  const newB = ratingB + K_FACTOR * ((1 - scoreA) - (1 - expectedA));
  return [newA, newB];
}
