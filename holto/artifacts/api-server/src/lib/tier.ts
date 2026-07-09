import { getUncachableStripeClient } from "../stripeClient";
import { stripeStorage } from "../stripeStorage";

export type Tier = "free" | "trip_pass" | "pro";

export const PRODUCT_TO_TIER: Record<string, Tier> = {
  prod_UhBlkhe3aN06Vk: "trip_pass",
  prod_UhBoJCSGdPeBGn: "pro",
  prod_UhBrAf4dQd1ODJ: "pro",
};

export function inferTierFromProductName(name: string): Tier {
  const n = name.toLowerCase();
  if (n.includes("trip pass") || n.includes("trippass")) return "trip_pass";
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

const OWNER_EMAILS = new Set(["gabriele.olivari@outlook.com"]);

export async function getUserTier(userId: number): Promise<Tier> {
  try {
    const user = await stripeStorage.getUser(userId);
    if (!user) return "free";

    if (OWNER_EMAILS.has(user.email)) return "pro";

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
