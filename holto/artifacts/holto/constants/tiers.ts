export type Tier = "free" | "trip_pass" | "pro";

export const PRODUCT_IDS = {
  TRIP_PASS: "prod_UhBlkhe3aN06Vk",
  PRO_MONTHLY: "prod_UhBoJCSGdPeBGn",
  PRO_ANNUAL: "prod_UhBrAf4dQd1ODJ",
} as const;

export const TIER_DISPLAY: Record<Tier, {
  label: string;
  badge: string;
  badgeColor: string;
  features: string[];
  lockedFeatures: string[];
}> = {
  free: {
    label: "Free",
    badge: "FREE",
    badgeColor: "#64748b",
    features: [
      "5 flight searches per day",
      "EU261 rights overview",
      "Cost of living comparison",
      "Basic disruption help",
    ],
    lockedFeatures: [
      "Ask HOLTO AI assistant",
      "My Flight live monitor",
      "Full EU261 calculator",
    ],
  },
  trip_pass: {
    label: "Trip Pass",
    badge: "7 DAYS",
    badgeColor: "#0d9488",
    features: [
      "Unlimited flight searches",
      "Ask HOLTO AI assistant",
      "My Flight live monitor",
      "Full EU261 calculator",
      "All 4 destination comparisons",
      "Valid for 7 days from purchase",
    ],
    lockedFeatures: [],
  },
  pro: {
    label: "Holto Pro",
    badge: "PRO",
    badgeColor: "#7c3aed",
    features: [
      "Everything in Trip Pass",
      "Unlimited Ask HOLTO AI",
      "Unlimited flight monitors",
      "Full Living abroad data",
      "Ongoing — monthly or annual",
    ],
    lockedFeatures: [],
  },
};
