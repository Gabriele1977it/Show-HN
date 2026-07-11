import {
  countryStaysTable,
  db,
  pushTokensTable,
  sentRemindersTable,
  tripItemsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, gte, lte } from "drizzle-orm";

import { computeResidency, type Stay } from "./residency";
import { buildFlightReminder, buildResidencyReminders, type ReminderMsg } from "./reminder-messages";
import { sendEmail } from "./email";
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

async function runResidencyReminders(): Promise<number> {
  const stays = await db
    .select({
      userId: countryStaysTable.userId,
      countryCode: countryStaysTable.countryCode,
      countryName: countryStaysTable.countryName,
      arrivalDate: countryStaysTable.arrivalDate,
      departureDate: countryStaysTable.departureDate,
    })
    .from(countryStaysTable);
  if (!stays.length) return 0;

  const byUser = new Map<number, Stay[]>();
  for (const s of stays) {
    const list = byUser.get(s.userId) ?? [];
    list.push({ countryCode: s.countryCode, countryName: s.countryName, arrivalDate: s.arrivalDate, departureDate: s.departureDate });
    byUser.set(s.userId, list);
  }

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

// One pass over all proactive reminders. Best-effort; never throws.
export async function runProactiveReminders(): Promise<{ residency: number; flights: number }> {
  let residency = 0;
  let flights = 0;
  try {
    residency = await runResidencyReminders();
  } catch (err) {
    logger.error({ err }, "residency reminders failed");
  }
  try {
    flights = await runFlightReminders();
  } catch (err) {
    logger.error({ err }, "flight reminders failed");
  }
  if (residency || flights) logger.info({ residency, flights }, "Proactive reminders sent");
  return { residency, flights };
}
