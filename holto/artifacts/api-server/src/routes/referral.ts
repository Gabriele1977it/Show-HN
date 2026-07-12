import { db, usersTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { makeSlug } from "../lib/slug";

const router: IRouter = Router();

// The signed-in user's share code + how many people they've brought in. Codes
// are lazily backfilled for accounts created before referrals existed.
router.get("/referral", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const [user] = await db.select({ referralCode: usersTable.referralCode }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let code = user.referralCode;
  if (!code) {
    code = makeSlug(8);
    await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, userId));
  }

  const [row] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.referredBy, userId));
  res.json({ code, invited: row?.value ?? 0 });
});

export default router;
