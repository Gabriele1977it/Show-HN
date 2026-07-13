import {
  countryStaysTable,
  db,
  loyaltyProgramsTable,
  pushTokensTable,
  sentRemindersTable,
  tripItemsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";

import { computeResidency, type Stay } from "./residency";
import { computeSchengen } from "./schengen";
import { buildFlightReminder, buildLoyaltyReminder, buildResidencyReminders, buildSchengenReminder, type ReminderMsg } from "./reminder-messages";
import { sendEmail } from "./email";
import { getNews } from "./news";
import { sendPush } from "./push";
import { logger } from "./logger";

// ── Delivery ────────────────────────────────────────────────────────────────

// Insert a dedupe row; returns true only the first time (so we send once).
async function claim(userId: number, msg: ReminderMsg): Promise<boolean> {
  const rows = await db
    .insert(sentRemindersTable)
    .values({ userId, kind: msg.kind, refKey: msg.refKey })
    .onConflictDoNothing({ target: [sentRemindersTable.userId, sentRemindersTable.refKey] })
    .returning({ id: sentRemindersTable.id });
  return rows.length > 0;
}

async function deliver(userId: number, msg: ReminderMsg): Promise<void> {
  const tokens = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(eq(pushTokensTable.userId, userId));
  const tokenValues = tokens.map((t) => t.token);
  const result = tokenValues.length ? await sendPush(tokenValues, msg) : { sent: 0, failed: 0 };

  if (result.sent === 0) {
    const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId));
    if (user?.email) {
      await sendEmail({ to: user.email, subject: msg.title, text: `${msg.body}\n\nOpen HOLTO for details.` });
    }
  }
  logger.info({ userId, refKey: msg.refKey, push: result }, "Proactive reminder delivered");
}

// ── Runners ─────────────────────────────────────────────────────────────────

// All country stays grouped by user — shared by the residency and Schengen runs.
async function loadStaysByUser(): Promise<Map<number, Stay[]>> {
  const rows = await db
    .select({
      userId: countryStaysTable.userId,
      countryCode: countryStaysTable.countryCode,
      countryName: countryStaysTable.countryName,
      arrivalDate: countryStaysTable.arrivalDate,
      departureDate: countryStaysTable.departureDate,
    })
    .from(countryStaysTable);

  const byUser = new Map<number, Stay[]>();
  for (const s of rows) {
    const list = byUser.get(s.userId) ?? [];
    list.push({ countryCode: s.countryCode, countryName: s.countryName, arrivalDate: s.arrivalDate, departureDate: s.departureDate });
    byUser.set(s.userId, list);
  }
  return byUser;
}

async function runResidencyReminders(): Promise<number> {
  const byUser = await loadStaysByUser();
  if (byUser.size === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const year = new Date().getUTCFullYear();
  let sent = 0;
  for (const [userId, userStays] of byUser) {
    const residencies = computeResidency(userStays, today);
    for (const msg of buildResidencyReminders(residencies, year)) {
      if (await claim(userId, msg)) {
        await deliver(userId, msg);
        sent += 1;
      }
    }
  }
  return sent;
}

async function runSchengenReminders(): Promise<number> {
  const byUser = await loadStaysByUser();
  if (byUser.size === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  let sent = 0;
  for (const [userId, userStays] of byUser) {
    const status = computeSchengen(userStays, today);
    if (!status.applicable) continue;
    const msg = buildSchengenReminder(status);
    if (msg && (await claim(userId, msg))) {
      await deliver(userId, msg);
      sent += 1;
    }
  }
  return sent;
}

// Flights departing within this window get a "head to the airport" nudge.
const FLIGHT_LOOKAHEAD_MS = 3 * 60 * 60 * 1000;

async function runFlightReminders(): Promise<number> {
  const now = new Date();
  const until = new Date(now.getTime() + FLIGHT_LOOKAHEAD_MS);
  const items = await db
    .select({ id: tripItemsTable.id, userId: tripItemsTable.userId, title: tripItemsTable.title, startAt: tripItemsTable.startAt })
    .from(tripItemsTable)
    .where(and(eq(tripItemsTable.type, "flight"), gte(tripItemsTable.startAt, now), lte(tripItemsTable.startAt, until)));

  let sent = 0;
  for (const item of items) {
    const msg = buildFlightReminder(item);
    if (await claim(item.userId, msg)) {
      await deliver(item.userId, msg);
      sent += 1;
    }
  }
  return sent;
}

async function runLoyaltyReminders(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const programs = await db
    .select({
      id: loyaltyProgramsTable.id,
      userId: loyaltyProgramsTable.userId,
      programName: loyaltyProgramsTable.programName,
      tier: loyaltyProgramsTable.tier,
      expiresAt: loyaltyProgramsTable.expiresAt,
    })
    .from(loyaltyProgramsTable)
    .where(isNotNull(loyaltyProgramsTable.expiresAt));

  let sent = 0;
  for (const p of programs) {
    const msg = buildLoyaltyReminder(p, today);
    if (msg && (await claim(p.userId, msg))) {
      await deliver(p.userId, msg);
      sent += 1;
    }
  }
  return sent;
}

// A once-a-day "your travel day" digest for anyone with a flight in the next
// 24h — a proactive morning nudge (distinct from the 3h "leave now" reminder),
// with today's top travel headline folded in so it's a genuine reason to open
// the app. Deduped to one per user per day via the sent_reminders table.
const DIGEST_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

async function runDailyDigest(): Promise<number> {
  const now = new Date();
  const until = new Date(now.getTime() + DIGEST_LOOKAHEAD_MS);
  const items = await db
    .select({ id: tripItemsTable.id, userId: tripItemsTable.userId, title: tripItemsTable.title, startAt: tripItemsTable.startAt })
    .from(tripItemsTable)
    .where(and(eq(tripItemsTable.type, "flight"), gte(tripItemsTable.startAt, now), lte(tripItemsTable.startAt, until)))
    .orderBy(tripItemsTable.startAt);

  if (items.length === 0) return 0;

  // One shared travel headline (best-effort — the digest still sends without it).
  let headline: string | null = null;
  try {
    const news = await getNews("travel", 1);
    headline = news[0]?.title ?? null;
  } catch {
    /* news is optional */
  }

  const day = now.toISOString().slice(0, 10);
  const seen = new Set<number>();
  let sent = 0;
  for (const item of items) {
    if (seen.has(item.userId)) continue; // one digest per user per day
    seen.add(item.userId);

    const flight = item.title?.trim() || "your flight";
    const body = headline
      ? `${flight} is coming up. Tap for your timeline, gate and live status. Travel news: ${headline}`
      : `${flight} is coming up. Tap for your travel-day timeline, gate and live status.`;
    const msg: ReminderMsg = { kind: "digest", refKey: `digest:${day}`, title: "Your travel day ✈️", body, data: { type: "digest", tripItemId: item.id } };

    if (await claim(item.userId, msg)) {
      await deliver(item.userId, msg);
      sent += 1;
    }
  }
  return sent;
}

// One pass over all proactive reminders. Best-effort; never throws.
export async function runProactiveReminders(): Promise<{ residency: number; schengen: number; flights: number; loyalty: number; digest: number }> {
  let residency = 0;
  let schengen = 0;
  let flights = 0;
  let loyalty = 0;
  let digest = 0;
  try {
    residency = await runResidencyReminders();
  } catch (err) {
    logger.error({ err }, "residency reminders failed");
  }
  try {
    schengen = await runSchengenReminders();
  } catch (err) {
    logger.error({ err }, "schengen reminders failed");
  }
  try {
    flights = await runFlightReminders();
  } catch (err) {
    logger.error({ err }, "flight reminders failed");
  }
  try {
    loyalty = await runLoyaltyReminders();
  } catch (err) {
    logger.error({ err }, "loyalty reminders failed");
  }
  try {
    digest = await runDailyDigest();
  } catch (err) {
    logger.error({ err }, "daily digest failed");
  }
  if (residency || schengen || flights || loyalty || digest) {
    logger.info({ residency, schengen, flights, loyalty, digest }, "Proactive reminders sent");
  }
  return { residency, schengen, flights, loyalty, digest };
}
