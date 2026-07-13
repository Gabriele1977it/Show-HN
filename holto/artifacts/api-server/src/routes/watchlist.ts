import { db, savedDestinationsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// A traveller's saved-destinations watchlist. Deterministic, free — the client
// hangs the existing advisory / FX / cost-of-living data off each code.
router.get("/watchlist", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(savedDestinationsTable)
    .where(eq(savedDestinationsTable.userId, req.auth!.userId))
    .orderBy(desc(savedDestinationsTable.createdAt));
  res.json({ destinations: rows });
});

router.post("/watchlist", requireAuth, async (req, res): Promise<void> => {
  const { code, name } = req.body as { code?: string; name?: string };
  const c = String(code ?? "").trim().toUpperCase();
  const n = String(name ?? "").trim().slice(0, 80);
  if (!/^[A-Z]{2}$/.test(c) || !n) {
    res.status(400).json({ error: "A country code and name are required." });
    return;
  }
  const [row] = await db
    .insert(savedDestinationsTable)
    .values({ userId: req.auth!.userId, code: c, name: n })
    .onConflictDoNothing({ target: [savedDestinationsTable.userId, savedDestinationsTable.code] })
    .returning();
  res.status(201).json({ saved: row ?? null, code: c });
});

router.delete("/watchlist/:code", requireAuth, async (req, res): Promise<void> => {
  const c = String(req.params.code ?? "").trim().toUpperCase();
  await db
    .delete(savedDestinationsTable)
    .where(and(eq(savedDestinationsTable.userId, req.auth!.userId), eq(savedDestinationsTable.code, c)));
  res.json({ removed: c });
});

export default router;
