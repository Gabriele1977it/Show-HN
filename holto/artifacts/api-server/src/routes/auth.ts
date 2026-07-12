import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth, signToken } from "../middlewares/auth";
import { getUserTier, isOwnerEmail, TIER_FEATURES } from "../lib/tier";
import { makeSlug } from "../lib/slug";

const router: IRouter = Router();

function safeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    starterPackEmail: user.starterPackEmail ?? null,
    isOwner: isOwnerEmail(user.email),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, name, ref } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    ref?: string;
  };

  if (!email?.trim() || !password || !name?.trim()) {
    res.status(400).json({ error: "Name, email and password are all required." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.trim().toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists. Try signing in instead." });
    return;
  }

  // Resolve a referral code to the inviter (best effort — never blocks signup).
  let referredBy: number | null = null;
  if (ref?.trim()) {
    const [inviter] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referralCode, ref.trim()))
      .limit(1);
    if (inviter) referredBy = inviter.id;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      passwordHash,
      referralCode: makeSlug(8),
      referredBy,
    })
    .returning();

  const token = signToken({ userId: user.id, email: user.email });

  req.log.info({ userId: user.id }, "User registered");
  res.status(201).json({ token, user: safeUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email?.trim() || !password) {
    res.status(400).json({ error: "Please enter your email and password." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.trim().toLowerCase()))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "No account found with that email. Check the address or create an account." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "That password doesn't match. Try again or reset your password." });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });

  req.log.info({ userId: user.id }, "User logged in");
  res.json({ token, user: safeUser(user) });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.auth!.userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(safeUser(user));
});

router.get("/auth/me/tier", requireAuth, async (req, res): Promise<void> => {
  const tier = await getUserTier(req.auth!.userId);
  res.json({ tier, features: TIER_FEATURES[tier] });
});

router.post("/auth/starter-pack", requireAuth, async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };

  if (!email?.trim()) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ starterPackEmail: email.trim().toLowerCase() })
    .where(eq(usersTable.id, req.auth!.userId))
    .returning();

  req.log.info({ userId: user.id, starterPackEmail: email.trim() }, "Starter pack subscribed");
  res.json(safeUser(user));
});

export default router;
