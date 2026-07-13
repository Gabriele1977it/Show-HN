import {
  claimsTable,
  countryStaysTable,
  dailyUsageTable,
  db,
  disruptionsTable,
  expensesTable,
  loyaltyProgramsTable,
  monitoredFlightsTable,
  pushTokensTable,
  tripsTable,
  usersTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";
import { and, count, desc, eq, gte, ilike, or, sql, sum } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { requireOwner } from "../middlewares/owner";
import { isOwnerEmail } from "../lib/tier";
import { makeSlug } from "../lib/slug";

const router: IRouter = Router();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TIERS = new Set(["free", "trip_pass", "pro"]);

// Every admin route is owner-only (and returns 404 to everyone else).
router.use("/admin", requireAuth, requireOwner);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableCount(table: any): Promise<number> {
  const [row] = await db.select({ value: count() }).from(table);
  return row?.value ?? 0;
}

// Behind-the-scenes overview: usage counts + which integrations are configured
// (booleans only — never the secret values themselves).
router.get("/admin/overview", async (_req, res): Promise<void> => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [users, newUsers, trips, flights, disruptions, claims, expenses, pushTokens, loyalty, stays] = await Promise.all([
    tableCount(usersTable),
    db.select({ value: count() }).from(usersTable).where(gte(usersTable.createdAt, weekAgo)).then((r) => r[0]?.value ?? 0),
    tableCount(tripsTable),
    db.select({ value: count() }).from(monitoredFlightsTable).where(eq(monitoredFlightsTable.active, true)).then((r) => r[0]?.value ?? 0),
    tableCount(disruptionsTable),
    tableCount(claimsTable),
    tableCount(expensesTable),
    tableCount(pushTokensTable),
    tableCount(loyaltyProgramsTable),
    tableCount(countryStaysTable),
  ]);

  // AI-cost visibility: token-costing requests today and over the last 30 days.
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [aiTodayRow, aiMonthRow, searchTodayRow] = await Promise.all([
    db.select({ v: sum(dailyUsageTable.aiCalls) }).from(dailyUsageTable).where(eq(dailyUsageTable.day, todayStr)),
    db.select({ v: sum(dailyUsageTable.aiCalls) }).from(dailyUsageTable).where(gte(dailyUsageTable.day, monthAgoStr)),
    db.select({ v: sum(dailyUsageTable.flightSearches) }).from(dailyUsageTable).where(eq(dailyUsageTable.day, todayStr)),
  ]);
  const num = (v: string | null | undefined): number => Number(v ?? 0);

  res.json({
    counts: { users, newUsersThisWeek: newUsers, trips, monitoredFlightsActive: flights, disruptions, claims, expenses, pushTokens, loyaltyPrograms: loyalty, countryStays: stays },
    aiUsage: {
      callsToday: num(aiTodayRow[0]?.v),
      callsLast30d: num(aiMonthRow[0]?.v),
      searchesToday: num(searchTodayRow[0]?.v),
      dailyCap: Number(process.env.AI_CALLS_PER_DAY) > 0 ? Number(process.env.AI_CALLS_PER_DAY) : null,
    },
    integrations: {
      geminiAI: !!process.env.GEMINI_API_KEY,
      openAI: !!process.env.OPENAI_API_KEY,
      flights_airlabs: !!process.env.AIRLABS_API_KEY,
      maps_mapbox: !!process.env.MAPBOX_TOKEN,
      costOfLiving_zyla: !!process.env.ZYLA_API_KEY,
      stripe: !!process.env.STRIPE_SECRET_KEY,
      sessionSecret: !!process.env.SESSION_SECRET,
      ownerEmailsSet: !!process.env.OWNER_EMAILS,
      pushExpo: !!process.env.EXPO_ACCESS_TOKEN,
      email_resend: !!process.env.RESEND_API_KEY,
      awardwallet: !!process.env.AWARDWALLET_API_KEY,
    },
    generatedAt: new Date().toISOString(),
  });
});

// Top AI consumers over the last 30 days — spot heavy usage before it costs.
router.get("/admin/usage", async (_req, res): Promise<void> => {
  const monthAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      userId: dailyUsageTable.userId,
      email: usersTable.email,
      aiCalls: sql<number>`sum(${dailyUsageTable.aiCalls})::int`,
      searches: sql<number>`sum(${dailyUsageTable.flightSearches})::int`,
    })
    .from(dailyUsageTable)
    .innerJoin(usersTable, eq(usersTable.id, dailyUsageTable.userId))
    .where(gte(dailyUsageTable.day, monthAgoStr))
    .groupBy(dailyUsageTable.userId, usersTable.email)
    .orderBy(desc(sql`sum(${dailyUsageTable.aiCalls})`))
    .limit(20);
  res.json({ windowDays: 30, topConsumers: rows });
});

interface UserRow {
  id: number;
  email: string;
  name: string;
  grantedTier: string | null;
  stripeCustomerId: string | null;
  tripPassExpiresAt: Date | null;
  createdAt: Date;
}

// Cheap effective-tier for the list (no per-user Stripe calls).
function displayTier(u: UserRow): string {
  if (isOwnerEmail(u.email)) return "owner";
  if (u.grantedTier === "pro" || u.grantedTier === "trip_pass") return `${u.grantedTier} (granted)`;
  if (u.tripPassExpiresAt && new Date(u.tripPassExpiresAt) > new Date()) return "trip_pass";
  if (u.stripeCustomerId) return "stripe";
  return "free";
}

router.get("/admin/users", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10) || 100, 1), 500);

  const rows = (await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      grantedTier: usersTable.grantedTier,
      stripeCustomerId: usersTable.stripeCustomerId,
      tripPassExpiresAt: usersTable.tripPassExpiresAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(q ? or(ilike(usersTable.email, `%${q}%`), ilike(usersTable.name, `%${q}%`)) : undefined)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)) as UserRow[];

  res.json({
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      tier: displayTier(u),
      grantedTier: u.grantedTier,
      hasStripe: !!u.stripeCustomerId,
      createdAt: u.createdAt,
    })),
  });
});

// Allocate (or clear) a comp tier for an existing user.
router.patch("/admin/users/:id/tier", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { tier } = req.body as { tier?: string };
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  if (!tier || !TIERS.has(tier)) {
    res.status(400).json({ error: "tier must be free, trip_pass or pro" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ grantedTier: tier === "free" ? null : tier })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, email: usersTable.email, grantedTier: usersTable.grantedTier });
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ id: updated.id, email: updated.email, grantedTier: updated.grantedTier });
});

// Onboard someone (e.g. an influencer): create the account if new and set the
// tier. Returns a temp password to share when we generated one. If the email
// already exists we just (re)allocate the tier.
router.post("/admin/users", async (req, res): Promise<void> => {
  const emailRaw = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const name = typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : emailRaw.split("@")[0];
  const tier = typeof req.body?.tier === "string" && TIERS.has(req.body.tier) ? req.body.tier : "pro";
  const providedPw = typeof req.body?.password === "string" && req.body.password.length >= 8 ? req.body.password : null;

  if (!EMAIL_RE.test(emailRaw)) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, emailRaw)).limit(1);
  if (existing) {
    await db.update(usersTable).set({ grantedTier: tier === "free" ? null : tier }).where(eq(usersTable.id, existing.id));
    res.json({ created: false, user: { id: existing.id, email: existing.email, name: existing.name }, tier });
    return;
  }

  const tempPassword = providedPw ?? makeSlug(12);
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ email: emailRaw, name: name || "Guest", passwordHash, grantedTier: tier === "free" ? null : tier })
    .returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name });

  req.log.info({ email: emailRaw, tier }, "Admin created user");
  res.status(201).json({
    created: true,
    user,
    tier,
    tempPassword: providedPw ? undefined : tempPassword, // share this with the invitee
  });
});

export default router;
