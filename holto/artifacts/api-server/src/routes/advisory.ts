import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { getAdvisory } from "../lib/advisory";

const router: IRouter = Router();

// Live advisory levels for several countries at once: /advisories?codes=GB,FR,TH
// Each getAdvisory call is cached per-country, so a batch is cheap. Used by the
// Travel Alerts tool to show a watchlist at a glance.
router.get("/advisories", requireAuth, async (req, res): Promise<void> => {
  const codes = String(req.query.codes ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c))
    .slice(0, 25); // sane cap
  const unique = [...new Set(codes)];
  const results = await Promise.all(
    unique.map(async (code) => ({ code, advisory: await getAdvisory(code) })),
  );
  res.json({ results });
});

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
