import { dailyUsageTable, db } from "@workspace/db";
import { sql } from "drizzle-orm";

import { getUserTier, TIER_FEATURES } from "./tier";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Atomically record one flight search for today and return the running count.
async function recordFlightSearch(userId: number): Promise<number> {
  const [row] = await db
    .insert(dailyUsageTable)
    .values({ userId, day: today(), flightSearches: 1 })
    .onConflictDoUpdate({
      target: [dailyUsageTable.userId, dailyUsageTable.day],
      set: { flightSearches: sql`${dailyUsageTable.flightSearches} + 1` },
    })
    .returning({ flightSearches: dailyUsageTable.flightSearches });
  return row?.flightSearches ?? 1;
}

export interface SearchAllowance {
  allowed: boolean;
  limit: number; // -1 = unlimited
  used: number;
}

// Enforce the per-day flight-search limit for the user's tier. Paid tiers are
// unlimited. On any failure we fail open (allow) so a counter hiccup never
// blocks a traveller mid-trip.
export async function allowFlightSearch(userId: number): Promise<SearchAllowance> {
  try {
    const tier = await getUserTier(userId);
    const limit = TIER_FEATURES[tier].flightSearchesPerDay;
    if (limit < 0) return { allowed: true, limit: -1, used: 0 };
    const used = await recordFlightSearch(userId);
    return { allowed: used <= limit, limit, used };
  } catch {
    return { allowed: true, limit: -1, used: 0 };
  }
}
