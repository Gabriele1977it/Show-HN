import { db, monitoredFlightsTable, pushTokensTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

import { logger } from "./logger";
import { sendPush } from "./push";
import { sendEmail } from "./email";
import {
  buildFlightResponse,
  fetchFlightData,
  type FlightResponse,
  type FlightStatus,
} from "./flights";
import { detectStatusChange, type FlightSnapshot, type StatusChange } from "./status-change";

export { detectStatusChange } from "./status-change";

function snapshotFrom(status: FlightStatus | null, data: unknown): FlightSnapshot | null {
  if (data && typeof data === "object" && "status" in data) {
    const d = data as Partial<FlightResponse>;
    return { status: (d.status as FlightStatus) ?? "unknown", depDelay: d.depDelay ?? null };
  }
  if (status) return { status: status as FlightStatus, depDelay: null };
  return null;
}

async function deliverAlert(
  userId: number,
  flightNumber: string,
  monitoredId: number,
  resp: FlightResponse,
  change: StatusChange,
): Promise<void> {
  const title = `${flightNumber}: ${change.severity === "critical" ? "action may be needed" : "update"}`;
  const body = change.reason;
  const data = {
    type: "flight_alert",
    monitoredId,
    flightNumber,
    status: resp.status,
  };

  const tokens = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(eq(pushTokensTable.userId, userId));

  const tokenValues = tokens.map((t) => t.token);
  const pushResult = tokenValues.length > 0 ? await sendPush(tokenValues, { title, body, data }) : { sent: 0, failed: 0 };

  // Email fallback when no push was delivered (no tokens, or all failed).
  if (pushResult.sent === 0) {
    const [user] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: title,
        text: `${body}\n\nOpen HOLTO to see your rights and next steps for flight ${flightNumber}.`,
      });
    }
  }

  logger.info({ userId, flightNumber, severity: change.severity, push: pushResult }, "Flight alert delivered");
}

/**
 * Run one monitoring pass over every active tracked flight: fetch the current
 * status, persist it, and fire an alert when `detectStatusChange` says so.
 * Resilient — one flight's failure never aborts the pass.
 */
export async function pollOnce(): Promise<{ checked: number; alerts: number }> {
  const apiKey = process.env.AIRLABS_API_KEY;
  if (!apiKey) {
    logger.warn("AIRLABS_API_KEY not set — monitor pass skipped");
    return { checked: 0, alerts: 0 };
  }

  const flights = await db.select().from(monitoredFlightsTable).where(eq(monitoredFlightsTable.active, true));

  let checked = 0;
  let alerts = 0;

  // Once a flight has landed or been cancelled its status won't meaningfully
  // change, so stop polling it — this keeps a forgotten past flight from
  // draining the AirLabs quota indefinitely.
  const TERMINAL: ReadonlySet<string> = new Set(["landed", "cancelled"]);

  for (const f of flights) {
    try {
      if (f.lastStatus && TERMINAL.has(f.lastStatus)) continue;
      const raw = await fetchFlightData(f.flightNumber, apiKey);
      if (!raw) continue; // data gap — leave the last known state intact
      const resp = buildFlightResponse(f.flightNumber, raw, null);
      if (resp.status === "unknown") continue;

      checked += 1;
      const prev = snapshotFrom(f.lastStatus as FlightStatus | null, f.lastStatusData);
      const next: FlightSnapshot = { status: resp.status, depDelay: resp.depDelay };
      const change = detectStatusChange(prev, next);

      await db
        .update(monitoredFlightsTable)
        .set({ lastStatus: resp.status, lastStatusData: resp, lastCheckedAt: new Date() })
        .where(eq(monitoredFlightsTable.id, f.id));

      if (change) {
        await deliverAlert(f.userId, f.flightNumber, f.id, resp, change);
        alerts += 1;
      }
    } catch (err) {
      logger.warn({ err, flightNumber: f.flightNumber, id: f.id }, "Monitor pass failed for flight");
    }
  }

  logger.info({ checked, alerts, tracked: flights.length }, "Monitor pass complete");
  return { checked, alerts };
}
