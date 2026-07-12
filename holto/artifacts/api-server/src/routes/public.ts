import { db, expensesTable, tripItemsTable, tripsTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { buildTripRecap, type RecapItem } from "../lib/trip-recap";
import { getRatesPerGBP, toGBP } from "../lib/fx";
import { logger } from "../lib/logger";

// Unauthenticated public trip recaps — the creator "link in bio" pages. Only
// trips the owner has explicitly published are exposed, and the payload is
// deliberately sanitised: booking references, notes and per-expense detail
// never leave the server. No auth so the creator's audience can open it.
const router: IRouter = Router();

router.get("/public/trips/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug ?? "").trim();
  if (!slug) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.publicSlug, slug)).limit(1);
  if (!trip || !trip.isPublic) {
    res.status(404).json({ error: "This trip isn't shared." });
    return;
  }

  const items = await db
    .select()
    .from(tripItemsTable)
    .where(eq(tripItemsTable.tripId, trip.id))
    .orderBy(asc(tripItemsTable.startAt));

  const recapItems: RecapItem[] = items.map((i) => ({
    type: i.type,
    title: i.title,
    location: i.location,
    startAt: i.startAt ? i.startAt.toISOString() : null,
  }));
  const recap = buildTripRecap({
    startDate: trip.startDate,
    endDate: trip.endDate,
    destination: trip.destination,
    items: recapItems,
  });

  // Spend total only (never individual expenses), and only if the owner opted in.
  let spendGBP: number | null = null;
  if (trip.publicShowSpend) {
    try {
      const rows = await db
        .select({ amount: expensesTable.amount, currency: expensesTable.currency })
        .from(expensesTable)
        .where(eq(expensesTable.tripId, trip.id));
      if (rows.length) {
        const rates = await getRatesPerGBP();
        let total = 0;
        for (const r of rows) {
          const gbp = toGBP(parseFloat(r.amount), r.currency, rates);
          if (gbp != null) total += gbp;
        }
        spendGBP = Math.round(total);
      } else {
        spendGBP = 0;
      }
    } catch (err) {
      logger.warn({ err, tripId: trip.id }, "public recap spend calc failed");
      spendGBP = null;
    }
  }

  // Sanitised timeline highlights — type/title/location/time only.
  const highlights = recapItems;

  res.json({
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    recap,
    spendGBP,
    highlights,
  });
});

export default router;
