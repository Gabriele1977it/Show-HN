import { analyticsDailyTable, db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Whitelisted event names — keeps the table's cardinality bounded and stops
// arbitrary strings inflating it. Add new events here as features ship.
const EVENTS = new Set([
  "app_open",
  "news_view",
  "today_view",
  "ask_used",
  "scan_booking",
  "scan_receipt",
  "claim_started",
  "watchlist_add",
  "upgrade_view",
  "calendar_add",
]);

// Privacy-friendly, aggregated analytics. No auth, no PII — just a per-day count
// per known event. Unknown events are silently ignored.
router.post("/analytics", async (req, res): Promise<void> => {
  const event = String((req.body as { event?: string })?.event ?? "").trim();
  if (!EVENTS.has(event)) {
    res.status(204).end();
    return;
  }
  const day = new Date().toISOString().slice(0, 10);
  try {
    await db
      .insert(analyticsDailyTable)
      .values({ day, event, count: 1 })
      .onConflictDoUpdate({
        target: [analyticsDailyTable.day, analyticsDailyTable.event],
        set: { count: sql`${analyticsDailyTable.count} + 1`, updatedAt: new Date() },
      });
  } catch {
    /* analytics must never break the app */
  }
  res.status(204).end();
});

export default router;
