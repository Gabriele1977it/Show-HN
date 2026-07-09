import { db, pushTokensTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Register (or refresh) an Expo push token for the signed-in user's device.
// Tokens are unique, so re-registering the same token just re-points it at the
// current user and updates the platform — safe to call on every app launch.
router.post("/push/register", requireAuth, async (req, res): Promise<void> => {
  const { token, platform } = req.body as { token?: string; platform?: string };

  if (!token?.trim()) {
    res.status(400).json({ error: "A push token is required." });
    return;
  }

  const [row] = await db
    .insert(pushTokensTable)
    .values({
      userId: req.auth!.userId,
      token: token.trim(),
      platform: platform?.trim() ?? null,
    })
    .onConflictDoUpdate({
      target: pushTokensTable.token,
      set: { userId: req.auth!.userId, platform: platform?.trim() ?? null, updatedAt: new Date() },
    })
    .returning();

  res.status(201).json({ id: row.id, token: row.token, platform: row.platform });
});

// Remove a push token (e.g. on logout or when the OS revokes it).
router.delete("/push/token", requireAuth, async (req, res): Promise<void> => {
  const token = ((req.body as { token?: string })?.token ?? (req.query.token as string))?.trim();

  if (!token) {
    res.status(400).json({ error: "A push token is required." });
    return;
  }

  await db
    .delete(pushTokensTable)
    .where(and(eq(pushTokensTable.token, token), eq(pushTokensTable.userId, req.auth!.userId)));

  res.status(204).send();
});

export default router;
