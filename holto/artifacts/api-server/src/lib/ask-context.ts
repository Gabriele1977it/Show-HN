import {
  countryStaysTable,
  db,
  monitoredFlightsTable,
  tripItemsTable,
  tripsTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { computeResidency, type Stay } from "./residency";

function fmtWhen(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace("T", " ");
  if (typeof v === "string") return v.slice(0, 16).replace("T", " ");
  return "";
}

// Build a compact, factual summary of what HOLTO knows about this traveller —
// their trips, tracked flights and days-in-country — so Ask HOLTO can answer
// personal questions accurately. Best-effort: never throws, returns "" on error.
export async function buildUserContext(userId: number): Promise<string> {
  const parts: string[] = [];
  try {
    const trips = await db
      .select()
      .from(tripsTable)
      .where(eq(tripsTable.userId, userId))
      .orderBy(desc(tripsTable.startDate))
      .limit(5);

    if (trips.length) {
      const ids = trips.map((t) => t.id);
      const items = await db
        .select()
        .from(tripItemsTable)
        .where(inArray(tripItemsTable.tripId, ids))
        .orderBy(asc(tripItemsTable.startAt));
      const byTrip = new Map<number, typeof items>();
      for (const it of items) {
        const list = byTrip.get(it.tripId) ?? [];
        list.push(it);
        byTrip.set(it.tripId, list);
      }
      const lines = trips.map((t) => {
        const its = (byTrip.get(t.id) ?? [])
          .slice(0, 6)
          .map((i) => `${i.type} "${i.title}"${i.startAt ? ` (${fmtWhen(i.startAt)})` : ""}`)
          .join("; ");
        const dates = t.startDate ? ` [${t.startDate}${t.endDate ? `–${t.endDate}` : ""}]` : "";
        return `- ${t.title}${dates}${its ? `: ${its}` : ""}`;
      });
      parts.push(`Their trips:\n${lines.join("\n")}`);
    }

    const flights = await db
      .select()
      .from(monitoredFlightsTable)
      .where(and(eq(monitoredFlightsTable.userId, userId), eq(monitoredFlightsTable.active, true)))
      .limit(6);
    if (flights.length) {
      parts.push(
        `Flights they're tracking:\n${flights
          .map((f) => `- ${f.flightNumber} → ${f.destination}${f.lastStatus ? ` (${f.lastStatus})` : ""}`)
          .join("\n")}`,
      );
    }

    const stays = await db.select().from(countryStaysTable).where(eq(countryStaysTable.userId, userId));
    if (stays.length) {
      const today = new Date().toISOString().slice(0, 10);
      const res = computeResidency(stays as Stay[], today).slice(0, 6);
      if (res.length) {
        parts.push(
          `Days in country this year (183-day rule):\n${res
            .map((c) => `- ${c.countryName}: ${c.daysThisYear}/${c.threshold} days (${c.status})`)
            .join("\n")}`,
        );
      }
    }
  } catch {
    return "";
  }
  return parts.join("\n\n");
}
