import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { getVisaRequirement, officialSources, visaDataAvailable } from "../lib/visa";

const router: IRouter = Router();

const DISCLAIMER =
  "This is guidance from a community-maintained dataset, not legal advice. Entry rules change often — always confirm with the official source below before you book or fly.";

// Is the guidance dataset reachable? (Official links always work regardless.)
router.get("/visa/status", requireAuth, async (_req, res): Promise<void> => {
  res.json({ guidance: await visaDataAvailable() });
});

// Visa & entry guidance for a passport + destination.
// /visa?from=GB&to=TH&name=Thailand
router.get("/visa", requireAuth, async (req, res): Promise<void> => {
  const from = String(req.query.from ?? "").trim().toUpperCase();
  const to = String(req.query.to ?? "").trim().toUpperCase();
  const destName = String(req.query.name ?? "").trim() || to;

  if (!/^[A-Z]{2}$/.test(from) || !/^[A-Z]{2}$/.test(to)) {
    res.status(400).json({ error: "A passport and destination country are required." });
    return;
  }

  const requirement = await getVisaRequirement(from, to);

  res.json({
    from,
    to,
    requirement, // null when the dataset is unavailable — client shows official links
    official: officialSources(from, to, destName),
    disclaimer: DISCLAIMER,
    source: "Passport Index (community dataset)",
  });
});

export default router;
