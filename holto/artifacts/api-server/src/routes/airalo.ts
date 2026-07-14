import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { airaloConfigured, getEsimPackages } from "../lib/airalo";

const router: IRouter = Router();

// Is the eSIM partner integration switched on?
router.get("/esim/status", requireAuth, (_req, res): void => {
  res.json({ configured: airaloConfigured() });
});

// Data plans available for a destination (two-letter country code). Cached, and
// empty when Airalo isn't configured — the client simply hides the section.
router.get("/esim/packages", requireAuth, async (req, res): Promise<void> => {
  const country = String(req.query.country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    res.status(400).json({ error: "A two-letter country code is required." });
    return;
  }
  const packages = await getEsimPackages(country);
  res.set("cache-control", "private, max-age=1800");
  res.json({ configured: airaloConfigured(), country, packages });
});

export default router;
