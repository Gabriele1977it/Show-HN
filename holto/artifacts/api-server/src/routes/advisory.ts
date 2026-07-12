import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { getAdvisory } from "../lib/advisory";

const router: IRouter = Router();

// Live travel-advisory level for a country (ISO-3166 alpha-2). Cached; returns
// { available: false } rather than erroring so the client can hide the banner.
router.get("/advisory/:code", requireAuth, async (req, res): Promise<void> => {
  const advisory = await getAdvisory(String(req.params.code ?? ""));
  if (!advisory) {
    res.json({ available: false });
    return;
  }
  res.json({ available: true, advisory });
});

export default router;
