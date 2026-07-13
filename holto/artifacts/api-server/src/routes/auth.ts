import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth, signToken } from "../middlewares/auth";
import { sendEmail } from "../lib/email";
import { getUserTier, isOwnerEmail, TIER_FEATURES } from "../lib/tier";
import { makeSlug } from "../lib/slug";

// Reset links point at the web app. Prefer an explicit base, then the shared
// APP_ORIGIN/PUBLIC_URL, and finally HOLTO's production domain.
const RESET_LINK_BASE = (
  process.env.RESET_URL_BASE ??
  process.env.APP_ORIGIN ??
  process.env.PUBLIC_URL ??
  "https://www.holtotravel.co.uk"
).replace(/\/+$/, "");

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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

// Step 1 of reset: email a one-time link. Always responds 200 with the same
// message whether or not the account exists — so the endpoint can't be used to
// discover which emails are registered.
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  const generic = { message: "If an account exists for that email, a reset link is on its way." };

  if (!email?.trim()) {
    res.status(400).json({ error: "Please enter your email address." });
    return;
  }
  const normalized = email.trim().toLowerCase();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalized)).limit(1);
  if (!user) {
    res.json(generic);
    return;
  }

  // 32 random bytes → the raw token goes in the link; only its hash is stored.
  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .update(usersTable)
    .set({ resetTokenHash: hashResetToken(rawToken), resetTokenExpiresAt: expiresAt })
    .where(eq(usersTable.id, user.id));

  const link = `${RESET_LINK_BASE}/reset-password?token=${rawToken}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your HOLTO password",
    text:
      `Hi ${user.name || "there"},\n\n` +
      `We got a request to reset your HOLTO password. Open the link below to choose a new one — it expires in 1 hour:\n\n` +
      `${link}\n\n` +
      `If you didn't ask for this, you can safely ignore this email; your password won't change.\n\n` +
      `— HOLTO`,
  });

  req.log.info({ userId: user.id }, "Password reset requested");
  res.json(generic);
});

// Step 2 of reset: exchange a valid, unexpired token for a new password.
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token?.trim() || !password) {
    res.status(400).json({ error: "Reset link and a new password are both required." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.resetTokenHash, hashResetToken(token.trim())), gt(usersTable.resetTokenExpiresAt, new Date())))
    .limit(1);

  if (!user) {
    res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db
    .update(usersTable)
    .set({ passwordHash, resetTokenHash: null, resetTokenExpiresAt: null })
    .where(eq(usersTable.id, user.id));

  const authToken = signToken({ userId: user.id, email: user.email });
  req.log.info({ userId: user.id }, "Password reset completed");
  res.json({ token: authToken, user: safeUser(user) });
});

export default router;
