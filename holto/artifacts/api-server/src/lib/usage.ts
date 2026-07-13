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

// Atomically record one token-costing AI request for today; returns the count.
async function recordAiCallInner(userId: number): Promise<number> {
  const [row] = await db
    .insert(dailyUsageTable)
    .values({ userId, day: today(), aiCalls: 1 })
    .onConflictDoUpdate({
      target: [dailyUsageTable.userId, dailyUsageTable.day],
      set: { aiCalls: sql`${dailyUsageTable.aiCalls} + 1` },
    })
    .returning({ aiCalls: dailyUsageTable.aiCalls });
  return row?.aiCalls ?? 1;
}

// Optional global per-user daily cap on AI requests (the owner's spend lever).
// Set AI_CALLS_PER_DAY to a positive number to enforce it; unset = no cap. Owner
// accounts are never capped. Records the call and reports the running total.
// Fails open so a counter hiccup never blocks a paying traveller.
export async function allowAiCall(userId: number): Promise<SearchAllowance> {
  try {
    const used = await recordAiCallInner(userId);
    const cap = Number(process.env.AI_CALLS_PER_DAY);
    if (!Number.isFinite(cap) || cap <= 0) return { allowed: true, limit: -1, used };
    const tier = await getUserTier(userId);
    if (tier !== "free") return { allowed: true, limit: -1, used }; // paid tiers uncapped
    return { allowed: used <= cap, limit: cap, used };
  } catch {
    return { allowed: true, limit: -1, used: 0 };
  }
}
