// Clerk authentication adapter.
//
// Wraps @clerk/express behind a tiny interface so the rest of the app never
// touches the SDK directly. When the Clerk keys are absent the adapter is
// disabled and the app falls back to the built-in password auth — tests and
// keyless dev environments keep working unchanged.
//
// The adapter only *identifies* the caller (verified Clerk session -> email);
// exchanging that identity for an EchoDeck account + session happens in
// app.js so accounts, keychains, and billing stay in one system.

import { clerkMiddleware, getAuth, createClerkClient } from "@clerk/express";

/** Disabled stub: same shape, no Clerk calls. Used when keys are missing. */
const disabled = {
  enabled: false,
  publishableKey: null,
  frontendApiOrigin: null,
  middleware: (_req, _res, next) => next(),
  sessionUserId: () => null,
  fetchEmail: async () => null,
};

/** The frontend-API host is base64-encoded in the publishable key. */
export function frontendApiFromKey(publishableKey) {
  const encoded = String(publishableKey ?? "").split("_")[2] ?? "";
  try {
    const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) && host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

export function createClerkAuth({ publishableKey, secretKey } = {}) {
  if (!publishableKey || !secretKey) return disabled;

  const host = frontendApiFromKey(publishableKey);
  const client = createClerkClient({ publishableKey, secretKey });
  return {
    enabled: true,
    publishableKey, // pk_* is public by design; safe to hand to the browser
    frontendApiOrigin: host ? `https://${host}` : null,
    middleware: clerkMiddleware({ publishableKey, secretKey }),

    /** Verified Clerk user id for this request, or null when signed out. */
    sessionUserId(req) {
      return getAuth(req)?.userId ?? null;
    },

    /** Primary email for a Clerk user (null if the user has none). */
    async fetchEmail(userId) {
      const user = await client.users.getUser(userId);
      return (
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses?.[0]?.emailAddress ??
        null
      );
    },
  };
}
