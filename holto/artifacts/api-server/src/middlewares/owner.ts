import type { NextFunction, Request, Response } from "express";

import { isOwnerEmail } from "../lib/tier";

// Gate for owner-only routes (the admin panel). Must run after requireAuth.
// Owner emails come from the OWNER_EMAILS env var. Returns 404 (not 403) to
// non-owners so the admin surface isn't even advertised as existing.
export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || !isOwnerEmail(req.auth.email)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  next();
}
