import { db, loyaltyProgramsTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import {
  awardwalletConfigured,
  createAuthUrl,
  findConnectedUserIdByEmail,
  getConnectedUserAccounts,
  getMemberAccountsByEmail,
  type NormalisedAccount,
} from "../lib/awardwallet";

const router: IRouter = Router();

// Is AwardWallet available, and is this user linked?
router.get("/awardwallet/status", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  const linked = !!user?.awardwalletUserId;
  // Generate a fresh per-user connect URL only when the user isn't linked yet —
  // linked users don't need it, so we avoid an extra call on every load.
  const connectUrl = awardwalletConfigured() && !linked ? await createAuthUrl(String(req.auth!.userId)) : null;
  res.json({
    configured: awardwalletConfigured(),
    connectUrl,
    linked,
    syncedAt: user?.awardwalletSyncedAt ?? null,
  });
});

// Link this HOLTO account to its AwardWallet connection. We resolve the
// connection strictly by matching the *authenticated* user's own email among
// the users who authorised us — a client-supplied id is never trusted, so a
// user can't link (and then read) someone else's shared loyalty accounts.
router.post("/awardwallet/link", requireAuth, async (req, res): Promise<void> => {
  if (!awardwalletConfigured()) {
    res.status(503).json({ error: "AwardWallet isn't set up yet." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const id = await findConnectedUserIdByEmail(user.email);
  if (!id) {
    res.status(404).json({
      error: "Couldn't find your AwardWallet connection. Authorise HOLTO from the AwardWallet connect page using this account's email, then try again.",
    });
    return;
  }

  await db.update(usersTable).set({ awardwalletUserId: id }).where(eq(usersTable.id, user.id));
  res.json({ linked: true });
});

// Pull the user's shared loyalty accounts and upsert them into their wallet.
// Only rows tagged source="awardwallet" are touched, so hand-entered programmes
// are never overwritten.
router.post("/awardwallet/sync", requireAuth, async (req, res): Promise<void> => {
  if (!awardwalletConfigured()) {
    res.status(503).json({ error: "AwardWallet isn't set up yet." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Resolve accounts: a stored connected-user link first, then a fresh
  // email match, then the Members list (works before invite approval).
  let accounts: NormalisedAccount[] = [];
  let awId = user.awardwalletUserId ?? null;
  if (!awId) {
    awId = await findConnectedUserIdByEmail(user.email);
    if (awId) await db.update(usersTable).set({ awardwalletUserId: awId }).where(eq(usersTable.id, user.id));
  }
  if (awId) accounts = await getConnectedUserAccounts(awId);
  if (accounts.length === 0) accounts = await getMemberAccountsByEmail(user.email);

  if (!awId && accounts.length === 0) {
    res.status(404).json({
      error: "Not connected to AwardWallet yet. Authorise HOLTO from the AwardWallet connect page (or add yourself as a Member), then sync.",
    });
    return;
  }

  const existing = await db
    .select()
    .from(loyaltyProgramsTable)
    .where(and(eq(loyaltyProgramsTable.userId, user.id), eq(loyaltyProgramsTable.source, "awardwallet")));
  const byName = new Map(existing.map((r) => [r.programName.toLowerCase(), r]));

  let imported = 0;
  let updated = 0;
  for (const acc of accounts) {
    const prior = byName.get(acc.programName.toLowerCase());
    if (prior) {
      await db
        .update(loyaltyProgramsTable)
        .set({
          category: acc.category,
          membershipNumber: acc.membershipNumber,
          tier: acc.tier,
          pointsBalance: acc.pointsBalance,
          expiresAt: acc.expiresAt,
        })
        .where(eq(loyaltyProgramsTable.id, prior.id));
      updated++;
    } else {
      await db.insert(loyaltyProgramsTable).values({
        userId: user.id,
        category: acc.category,
        programName: acc.programName,
        membershipNumber: acc.membershipNumber,
        tier: acc.tier,
        pointsBalance: acc.pointsBalance,
        expiresAt: acc.expiresAt,
        source: "awardwallet",
      });
      imported++;
    }
  }

  await db.update(usersTable).set({ awardwalletSyncedAt: new Date() }).where(eq(usersTable.id, user.id));
  res.json({ imported, updated, total: accounts.length });
});

export default router;
