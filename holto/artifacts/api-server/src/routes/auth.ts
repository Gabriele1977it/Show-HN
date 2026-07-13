import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { and, eq, gt, or } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth, signToken } from "../middlewares/auth";
import { sendEmail } from "../lib/email";
import { rateLimit } from "../lib/rate-limit";
import { getUserTier, isOwnerEmail, TIER_FEATURES } from "../lib/tier";
import { makeSlug } from "../lib/slug";

const HOUR = 60 * 60 * 1000;
// How long the premium perk lasts for someone who signs up with a creator's
// code. Change this one number to tune the offer.
const CREATOR_PERK_DAYS = 30;
function clientIp(req: { ip?: string }): string {
  return req.ip || "unknown";
}

// A real bcrypt hash to compare against when no account exists, so login timing
// doesn't reveal whether an email is registered. Computed once at startup.
const DUMMY_HASH = bcrypt.hashSync("holto-timing-equaliser", 12);

// Reset links point at the web app. Prefer an explicit base, then the shared
// APP_ORIGIN/PUBLIC_URL, and finally HOLTO's production domain.
const RESET_LINK_BASE = (
  process.env.RESET_URL_BASE ??
  process.env.APP_ORIGIN ??
  process.env.PUBLIC_URL ??
  "https://app.holtotravel.com"
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
  if (!rateLimit(`register:${clientIp(req)}`, 8, HOUR)) {
    res.status(429).json({ error: "Too many sign-ups from this connection. Please wait a little and try again." });
    return;
  }
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
  if (password.length < 8 || password.length > 200) {
    res.status(400).json({ error: "Password must be between 8 and 200 characters." });
    return;
  }
  if (email.trim().length > 254 || name.trim().length > 100) {
    res.status(400).json({ error: "That name or email is too long." });
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

  // Resolve a referral / creator code to the inviter (best effort — never
  // blocks signup). A creator code additionally unlocks the follower perk:
  // CREATOR_PERK_DAYS of full premium features (via tripPassExpiresAt, which
  // grants the same feature set as Pro).
  let referredBy: number | null = null;
  let tripPassExpiresAt: Date | null = null;
  const code = ref?.trim();
  if (code) {
    const [inviter] = await db
      .select({ id: usersTable.id, creatorCode: usersTable.creatorCode })
      .from(usersTable)
      .where(or(eq(usersTable.referralCode, code), eq(usersTable.creatorCode, code)))
      .limit(1);
    if (inviter) {
      referredBy = inviter.id;
      if (inviter.creatorCode && inviter.creatorCode === code) {
        tripPassExpiresAt = new Date(Date.now() + CREATOR_PERK_DAYS * 24 * 60 * 60 * 1000);
      }
    }
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
      tripPassExpiresAt,
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

  // Throttle brute-force: per account (ip+email) and a wider per-IP ceiling.
  const normEmail = email.trim().toLowerCase();
  if (!rateLimit(`login:${clientIp(req)}:${normEmail}`, 8, 15 * 60 * 1000) || !rateLimit(`login-ip:${clientIp(req)}`, 40, 15 * 60 * 1000)) {
    res.status(429).json({ error: "Too many sign-in attempts. Please wait a few minutes and try again." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normEmail))
    .limit(1);

  // Unified error + constant-ish timing to avoid leaking whether an account
  // exists (user enumeration). When there's no user we still run a bcrypt
  // compare against a dummy hash so the response time matches the real path.
  const INVALID = "Email or password is incorrect. Check your details, or create an account.";
  const valid = user
    ? await bcrypt.compare(password, user.passwordHash)
    : (await bcrypt.compare(password, DUMMY_HASH), false);
  if (!user || !valid) {
    res.status(401).json({ error: INVALID });
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

  // Throttle to prevent using this endpoint to bombard a victim with reset
  // emails (per target address) or to abuse our email quota (per IP). Returns
  // the same generic message so it still can't be used to probe accounts.
  if (!rateLimit(`forgot-ip:${clientIp(req)}`, 6, HOUR) || !rateLimit(`forgot-email:${normalized}`, 3, HOUR)) {
    res.json(generic);
    return;
  }

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
  if (!rateLimit(`reset:${clientIp(req)}`, 20, HOUR)) {
    res.status(429).json({ error: "Too many attempts. Please wait a little and try again." });
    return;
  }
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
