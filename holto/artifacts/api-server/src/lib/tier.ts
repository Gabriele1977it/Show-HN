import { getUncachableStripeClient } from "../stripeClient";
import { stripeStorage } from "../stripeStorage";

export type Tier = "free" | "trip_pass" | "pro";

// Map Stripe product IDs → tiers from the environment, so each deployment
// points at its own Stripe products. Set these on the api-server service:
//   STRIPE_PRODUCT_TRIP_PASS, STRIPE_PRODUCT_PRO_MONTHLY, STRIPE_PRODUCT_PRO_ANNUAL
// If they're not set, tiers are still inferred from the product NAME below, so
// sensibly-named products ("Trip Pass", "Holto Pro") work with no config.
function buildProductMap(): Record<string, Tier> {
  const map: Record<string, Tier> = {};
  // Accept either naming — the HOLTO_* names configured in Render, or the
  // STRIPE_PRODUCT_* names from the blueprint.
  const tripPass = process.env.HOLTO_TRIP_PASS?.trim() || process.env.STRIPE_PRODUCT_TRIP_PASS?.trim();
  const proMonthly = process.env.HOLTO_PRO_MONTH?.trim() || process.env.STRIPE_PRODUCT_PRO_MONTHLY?.trim();
  const proAnnual = process.env.HOLTO_PRO_YEARLY?.trim() || process.env.STRIPE_PRODUCT_PRO_ANNUAL?.trim();
  if (tripPass) map[tripPass] = "trip_pass";
  if (proMonthly) map[proMonthly] = "pro";
  if (proAnnual) map[proAnnual] = "pro";
  return map;
}

export const PRODUCT_TO_TIER: Record<string, Tier> = buildProductMap();

export function inferTierFromProductName(name: string): Tier {
  const n = name.toLowerCase();
  if ((n.includes("trip") && n.includes("pass")) || n.includes("trippass") || n.includes("day pass")) {
    return "trip_pass";
  }
  if (n.includes("pro")) return "pro";
  return "free";
}

export interface TierFeatures {
  askHolto: boolean;
  myFlightMonitor: boolean;
  eu261Calculator: boolean;
  flightSearchesPerDay: number;
}

export const TIER_FEATURES: Record<Tier, TierFeatures> = {
  free: {
    askHolto: false,
    myFlightMonitor: false,
    eu261Calculator: false,
    flightSearchesPerDay: 5,
  },
  trip_pass: {
    askHolto: true,
    myFlightMonitor: true,
    eu261Calculator: true,
    flightSearchesPerDay: -1,
  },
  pro: {
    askHolto: true,
    myFlightMonitor: true,
    eu261Calculator: true,
    flightSearchesPerDay: -1,
  },
};

// Emails that always get Pro (e.g. the owner's own account) — comma-separated
// in the OWNER_EMAILS env var. Empty by default.
const OWNER_EMAILS = new Set(
  (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export const TIER_ORDER: Tier[] = ["free", "trip_pass", "pro"];

export function isOwnerEmail(email: string | undefined | null): boolean {
  return !!email && OWNER_EMAILS.has(email.trim().toLowerCase());
}

function asTier(v: unknown): Tier | null {
  return v === "trip_pass" || v === "pro" || v === "free" ? v : null;
}

export async function getUserTier(userId: number): Promise<Tier> {
  try {
    const user = await stripeStorage.getUser(userId);
    if (!user) return "free";

    if (OWNER_EMAILS.has(user.email.toLowerCase())) return "pro";

    // Owner-granted comp tier (influencers) — no Stripe involved.
    const granted = asTier((user as { grantedTier?: unknown }).grantedTier);
    if (granted && granted !== "free") return granted;

    // Check active Trip Pass (locally tracked 7-day expiry)
    if (user.tripPassExpiresAt && user.tripPassExpiresAt > new Date()) {
      return "trip_pass";
    }

    if (!user.stripeCustomerId) return "free";

    const stripe = getUncachableStripeClient();

    // Check active subscriptions (Pro monthly / annual)
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "active",
      limit: 5,
      expand: ["data.items.data.price.product"],
    });

    for (const sub of subscriptions.data) {
      for (const item of sub.items.data) {
        const product = item.price.product;
        if (typeof product === "string") {
          const tier = PRODUCT_TO_TIER[product];
          if (tier) return tier;
        } else if (product && typeof product === "object" && "id" in product) {
          const p = product as { id: string; name: string };
          const tier = PRODUCT_TO_TIER[p.id] ?? inferTierFromProductName(p.name);
          if (tier !== "free") return tier;
        }
      }
    }

    return "free";
  } catch {
    return "free";
  }
}

export async function requireTier(userId: number, minimum: Tier): Promise<boolean> {
  const order: Tier[] = ["free", "trip_pass", "pro"];
  const tier = await getUserTier(userId);
  return order.indexOf(tier) >= order.indexOf(minimum);
}
