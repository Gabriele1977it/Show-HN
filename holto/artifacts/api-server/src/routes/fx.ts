import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { getRatesPerGBP, ratesFetchedAt } from "../lib/fx";

const router: IRouter = Router();

// The full rate table (units per GBP) so the client can convert any pair
// locally, instantly, and offline — no per-conversion round-trip or cost. The
// underlying feed is free and cached for a day.
router.get("/fx/rates", requireAuth, async (_req, res): Promise<void> => {
  const rates = await getRatesPerGBP();
  res.json({
    base: "GBP",
    rates, // { EUR: 1.17, USD: 1.27, ... } units per 1 GBP
    fetchedAt: ratesFetchedAt() ? new Date(ratesFetchedAt()!).toISOString() : null,
  });
});

export default router;
