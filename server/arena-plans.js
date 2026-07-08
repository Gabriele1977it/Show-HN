// Agent Arena — subscription tiers & entitlements.
//
// Account-level (not workspace) plans, distinct from EchoDeck's. Each tier
// gates ACCESS + LIMITS: models per comparison, which tasks are available,
// custom-task authoring, whether real (paid) runs are unlocked, and a daily
// real-run cap. Paid tiers also carry a monthly credit allowance for real runs
// (granted on activation) — the metered token cost is drawn from the wallet.
//
// Prices/limits are placeholders — trivially changeable. `Infinity` → `null`
// in the public form so it survives JSON.

export const ARENA_PLANS = {
  free: {
    id: "free", name: "Free", price: 0,
    maxModels: 2, tasks: "starter", runsPerDay: 10,
    realRuns: false, customTasks: false, monthlyCredits: 0,
    features: { realRuns: false, customTasks: false, publish: true, leaderboard: true },
    blurb: "Explore the simulated arena. Compare 2 models on starter workflows.",
  },
  pro: {
    id: "pro", name: "Pro", price: 19, priceYear: 190, stripeEnv: "ARENA_STRIPE_PRICE_PRO", stripeEnvYear: "ARENA_STRIPE_PRICE_PRO_ANNUAL",
    maxModels: 6, tasks: "all", runsPerDay: 100,
    realRuns: true, customTasks: false, monthlyCredits: 500,
    features: { realRuns: true, customTasks: false, publish: true, leaderboard: true },
    blurb: "Real model runs on all 10 workflows, up to 6 models per duel. Includes $5/mo of run credits.",
  },
  ultimate: {
    id: "ultimate", name: "Ultimate", price: 49, priceYear: 490, stripeEnv: "ARENA_STRIPE_PRICE_ULTIMATE", stripeEnvYear: "ARENA_STRIPE_PRICE_ULTIMATE_ANNUAL",
    maxModels: 12, tasks: "all", runsPerDay: Infinity,
    realRuns: true, customTasks: true, monthlyCredits: 2000,
    features: { realRuns: true, customTasks: true, publish: true, leaderboard: true },
    blurb: "Everything in Pro, plus up to 12 models, unlimited runs, and your own custom tasks. Includes $20/mo of run credits.",
  },
};

export const ARENA_DEFAULT_PLAN = "free";
export const ARENA_PAID_PLANS = ["pro", "ultimate"];

export function getArenaPlan(planId) {
  return ARENA_PLANS[planId] || ARENA_PLANS[ARENA_DEFAULT_PLAN];
}

export function arenaHasFeature(planId, feature) {
  return Boolean(getArenaPlan(planId).features[feature]);
}

/** How many preset tasks this plan can use (a "starter" subset vs all). */
export function taskLimit(planId, totalTasks) {
  return getArenaPlan(planId).tasks === "all" ? totalTasks : Math.min(3, totalTasks);
}

/** Serialise a plan for the API/UI (Infinity → null = unlimited). */
export function arenaPlanPublic(planId) {
  const p = getArenaPlan(planId);
  const n = (v) => (v === Infinity ? null : v);
  const priceYear = p.priceYear ?? null;
  const yearSavingPct = priceYear && p.price ? Math.round((1 - priceYear / (p.price * 12)) * 100) : 0;
  return {
    id: p.id, name: p.name, price: p.price, priceYear, yearSavingPct, blurb: p.blurb,
    maxModels: n(p.maxModels), tasks: p.tasks, runsPerDay: n(p.runsPerDay),
    monthlyCredits: p.monthlyCredits || 0, features: { ...p.features },
  };
}

export function listArenaPlans() {
  return Object.keys(ARENA_PLANS).filter((id) => !ARENA_PLANS[id].hidden).map(arenaPlanPublic);
}

export function allArenaPlanIds() {
  return Object.keys(ARENA_PLANS);
}
