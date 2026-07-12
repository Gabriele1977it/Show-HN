import { randomBytes } from "node:crypto";

import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { logger } from "../lib/logger";

// Never fall back to a known, in-repo default — that would let anyone forge
// tokens and impersonate any user. If SESSION_SECRET is unset we mint a strong
// random secret for this process instead: still secure, though tokens won't
// survive a restart, which is a loud signal to actually set SESSION_SECRET.
const JWT_SECRET: string = (() => {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) return configured;
  logger.error(
    "SESSION_SECRET is not set (or too short). Using a random per-process secret — sessions will reset on restart. Set SESSION_SECRET in the environment.",
  );
  return randomBytes(48).toString("hex");
})();

export interface AuthPayload {
  userId: number;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}
