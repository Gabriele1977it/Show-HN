// Plans & entitlements.
//
// A workspace is the billing entity. Each workspace has a plan; the plan sets
// hard limits (decks, cards, members) and feature flags (sharing, reminders,
// stats). Limits are enforced server-side — the UI only mirrors them.
//
// `Infinity` means unlimited internally; the public/serialised form maps it to
// `null` so it survives JSON.

// aiPerDay / importsPerDay are the per-workspace daily quotas for AI card
// fills and URL/YouTube imports — the operator's cost backstops per tier.
export const PLANS = {
  free: {
    id: "free", name: "Free", price: 0,
    maxDecks: 3, maxCards: 100, maxMembers: 1,
    aiPerDay: 0, importsPerDay: 5,
    features: { sharing: false, reminders: false, stats: false, enrich: false },
    blurb: "Try it out — a few decks to get going.",
  },
  pro: {
    id: "pro", name: "Pro", price: 7.99, priceYear: 79,
    maxDecks: Infinity, maxCards: Infinity, maxMembers: 1,
    aiPerDay: 300, importsPerDay: 50,
    features: { sharing: true, reminders: true, stats: true, enrich: true },
    blurb: "For serious language learners and independent creators: unlimited decks, sharing, reminders, stats + AI card fill.",
  },
  team: {
    id: "team", name: "Team", price: 19.99, priceYear: 199,
    maxDecks: Infinity, maxCards: Infinity, maxMembers: 10,
    aiPerDay: 600, importsPerDay: 100,
    features: { sharing: true, reminders: true, stats: true, enrich: true },
    blurb: "Everything in Pro, plus up to 10 teammates with roles.",
  },
  // Beta-tester tier: every feature unlocked so testers see the real product,
  // but with tight daily quotas so a test cohort can't burn the AI budget or
  // the transcript-API allowance. Not purchasable — granted from /admin.
  tester: {
    id: "tester", name: "Beta tester", price: 0, hidden: true,
    maxDecks: 20, maxCards: 1000, maxMembers: 2,
    aiPerDay: 25, importsPerDay: 10,
    features: { sharing: true, reminders: true, stats: true, enrich: true },
    blurb: "Full access for beta testing, with fair daily limits on AI fill and imports.",
  },
};

export const DEFAULT_PLAN = "free";
export const PAID_PLANS = ["pro", "team"];

export function getPlan(planId) {
  return PLANS[planId] || PLANS[DEFAULT_PLAN];
}

export function hasFeature(planId, feature) {
  return Boolean(getPlan(planId).features[feature]);
}

const LIMIT_KEY = { decks: "maxDecks", cards: "maxCards", members: "maxMembers" };

/** Can the workspace add `count` more of `kind` (decks|cards|members)? */
export function canAdd(planId, kind, currentCount, count = 1) {
  const max = getPlan(planId)[LIMIT_KEY[kind]] ?? Infinity;
  return currentCount + count <= max;
}

/** Serialise a plan for the API/UI (Infinity → null = unlimited). */
export function planPublic(planId) {
  const p = getPlan(planId);
  const n = (v) => (v === Infinity ? null : v);
  // Annual price + the % saved vs. paying monthly, so the UI can show a badge.
  const priceYear = p.priceYear ?? null;
  const yearSavingPct = priceYear && p.price ? Math.round((1 - priceYear / (p.price * 12)) * 100) : 0;
  return {
    id: p.id, name: p.name, price: p.price, priceYear, yearSavingPct, blurb: p.blurb,
    maxDecks: n(p.maxDecks), maxCards: n(p.maxCards), maxMembers: n(p.maxMembers),
    aiPerDay: p.aiPerDay ?? 0, importsPerDay: p.importsPerDay ?? 0,
    features: { ...p.features },
  };
}

/** Purchasable plans for the pricing pages (hidden tiers like tester excluded). */
export function listPlans() {
  return Object.keys(PLANS).filter((id) => !PLANS[id].hidden).map(planPublic);
}

/** Every plan id, including hidden tiers — for the admin panel's plan picker. */
export function allPlanIds() {
  return Object.keys(PLANS);
}
