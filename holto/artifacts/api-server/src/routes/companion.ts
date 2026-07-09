import { Router, type IRouter } from "express";

import { analyzeDisruption } from "../lib/ai";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/companion/analyze", requireAuth, async (req, res): Promise<void> => {
  const {
    airline,
    flightNumber,
    origin,
    destination,
    scheduledAt,
    disruptionType,
    details,
  } = req.body as {
    airline?: string;
    flightNumber?: string;
    origin?: string;
    destination?: string;
    scheduledAt?: string;
    disruptionType?: string;
    details?: string;
  };

  if (!airline || !flightNumber || !origin || !destination || !scheduledAt || !disruptionType) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const analysis = await analyzeDisruption({
    airline,
    flightNumber,
    origin,
    destination,
    scheduledAt,
    disruptionType,
    details: details ?? "",
  });

  res.json(analysis);
});

export default router;
