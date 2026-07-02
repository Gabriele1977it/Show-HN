// Onboarding progress model.
//
// Pure, DOM-free logic shared by the app UI (public/app.js) and the unit tests
// (test/onboarding.test.js). Given the workspace's decks plus a couple of
// client-side activation flags, it computes which "getting started" steps are
// done and what the learner should do next. Keeping this pure means the
// activation logic is testable without a browser.

export const ONBOARDING_STEPS = [
  { id: "build", label: "Build your first deck", hint: "Paste a transcript, import subtitles, or load a sample." },
  { id: "review", label: "Review a card", hint: "Open a deck and hit “Review due”." },
  { id: "shadow", label: "Try “Shadow & score”", hint: "Record yourself and get instant pronunciation feedback." },
  { id: "share", label: "Share or publish a deck", hint: "Send a public link, or list it on the marketplace." },
];

/**
 * @param {{ decks?: Array, flags?: {reviewed?: boolean, shadowed?: boolean} }} input
 * @returns {Array<{id,label,hint,done:boolean}>}
 */
export function onboardingSteps({ decks = [], flags = {} } = {}) {
  const done = {
    build: decks.length > 0,
    review: Boolean(flags.reviewed),
    shadow: Boolean(flags.shadowed),
    share: decks.some((d) => d && d.shareId),
  };
  return ONBOARDING_STEPS.map((s) => ({ ...s, done: Boolean(done[s.id]) }));
}

/** Summarise progress across the steps. */
export function onboardingProgress(steps) {
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  return { done, total, complete: total > 0 && done === total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** The first not-yet-done step (what to nudge next), or null when finished. */
export function nextStep(steps) {
  return steps.find((s) => !s.done) || null;
}
