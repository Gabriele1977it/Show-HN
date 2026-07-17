import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { AIRPORTS } from "../lib/airports";
import { getWeather } from "../lib/weather";

const router: IRouter = Router();

// Cached weather for signed-in users. Accepts either ?airport=IATA (resolved
// from our airport coordinate table) or explicit ?lat=&lon=. No key, no
// per-request cost; auth-gated so it can't be called anonymously at scale.
router.get("/weather", requireAuth, async (req, res): Promise<void> => {
  let lat = Number(req.query.lat);
  let lon = Number(req.query.lon);

  const airport = String(req.query.airport ?? "").trim().toUpperCase();
  if (airport && AIRPORTS[airport]) {
    lat = AIRPORTS[airport].lat;
    lon = AIRPORTS[airport].lon;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.json({ weather: null });
    return;
  }

  const weather = await getWeather(lat, lon);
  res.set("cache-control", "public, max-age=1800");
  res.json({ weather });
});

export default router;
