import { Router, type IRouter } from "express";

import { getNews, type NewsCategory } from "../lib/news";

const router: IRouter = Router();

// Public, cached news relay. No auth (it's read-only public content) and no
// per-request cost — everything is served from the 15-minute in-process cache.
router.get("/news", async (req, res): Promise<void> => {
  const raw = String(req.query.category ?? "").toLowerCase();
  const category: NewsCategory | undefined = raw === "world" || raw === "travel" ? raw : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 60);

  try {
    const items = await getNews(category, limit);
    // Let any CDN / browser cache briefly too.
    res.set("cache-control", "public, max-age=300");
    res.json({ items });
  } catch {
    res.json({ items: [] });
  }
});

export default router;
