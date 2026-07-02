// Plans & entitlements.
//
// A workspace is the billing entity. Each workspace has a plan; the plan sets
// hard limits (decks, cards, members) and feature flags (sharing, reminders,
// stats). Limits are enforced server-side — the UI only mirrors them.
//
// `Infinity` means unlimited internally; the public/serialised form maps it to
// `null` so it survives JSON.

export const PLANS = {
  free: {
    id: "free", name: "Free", price: 0,
    maxDecks: 3, maxCards: 100, maxMembers: 1,
    features: { sharing: false, reminders: false, stats: false, enrich: false },
    blurb: "Try it out — a few decks to get going.",
  },
  pro: {
    id: "pro", name: "Pro", price: 7.99, priceYear: 79,
    maxDecks: Infinity, maxCards: Infinity, maxMembers: 1,
    features: { sharing: true, reminders: true, stats: true, enrich: true },
    blurb: "For serious language learners and independent creators: unlimited decks, sharing, reminders, stats + AI card fill.",
  },
  team: {
    id: "team", name: "Team", price: 19.99, priceYear: 199,
    maxDecks: Infinity, maxCards: Infinity, maxMembers: 10,
    features: { sharing: true, reminders: true, stats: true, enrich: true },
    blurb: "Everything in Pro, plus up to 10 teammates with roles.",
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
    features: { ...p.features },
  };
}

export function listPlans() {
  return Object.keys(PLANS).map(planPublic);
}
