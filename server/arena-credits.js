// Agent Arena — credits (prepaid wallet) + run metering.
//
// Arena is a SaaS: visitors can try the simulated arena for free, but *real*
// model runs cost money. Signed-in accounts hold a prepaid balance (in whole
// cents of USD); each live run is metered against it. Top-ups are dev-mode
// instant by default, or Stripe Checkout (payment mode) when keys are set —
// mirroring the EchoDeck billing module's dev-mode fallback so it's testable.
//
// Balances live in the store (see getArenaWallet / addArenaCredits /
// chargeArenaRun); this module holds the pure pricing/config logic.

// Fixed top-up packs shown in the UI (amounts in cents).
export const CREDIT_PACKS = [
  { id: "p5", cents: 500, label: "$5" },
  { id: "p20", cents: 2000, label: "$20" },
  { id: "p50", cents: 5000, label: "$50" },
];

export function getPack(id) {
  return CREDIT_PACKS.find((p) => p.id === id) || null;
}

// Cost of a run = Σ (provider price/1k × tokens) over the models that actually
// ran live, times a markup (the SaaS margin), rounded up to whole cents (so a
// tiny run still registers a charge). `registry` is arenaModels.get().providers.
export function computeRunCents(liveResults, registry, markup = 1) {
  let dollars = 0;
  for (const r of liveResults) {
    if (!r.live) continue;
    const model = findModel(registry, r.id);
    const per1k = model?.costPer1k ?? 0;
    const tokens = (r.promptTokens || 0) + (r.completionTokens || 0);
    dollars += (per1k * tokens) / 1000;
  }
  const cents = Math.ceil(dollars * 100 * markup);
  return Math.max(liveResults.some((r) => r.live) ? 1 : 0, cents);
}

function findModel(registry, id) {
  for (const info of Object.values(registry || {})) {
    const m = (info.models || []).find((x) => x.id === id);
    if (m) return m;
  }
  return null;
}

export function creditsConfig(env = process.env) {
  return {
    // SaaS margin on top of raw provider cost (1 = pass-through).
    markup: Number(env.ARENA_CREDIT_MARKUP) || 1.5,
    // Free credits granted the first time an account opens its wallet, so new
    // users can try a real run immediately. Set 0 to disable.
    signupBonusCents: env.ARENA_SIGNUP_BONUS_CENTS != null ? Number(env.ARENA_SIGNUP_BONUS_CENTS) : 25,
    // Price per 1k tokens for the LLM judge (cheap model), billed with the run.
    judgeCostPer1k: Number(env.ARENA_JUDGE_COST_PER_1K) || 0.005,
  };
}
