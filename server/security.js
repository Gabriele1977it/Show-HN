// Security helpers: rate limiting + hardening headers. No dependencies.

/**
 * Fixed-window in-memory rate limiter. Returns a function (key, now) ->
 * { allowed, remaining, resetAt }. Suitable for a single-process deployment;
 * swap for a shared store (Redis) when you run multiple instances.
 */
export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100 } = {}) {
  const hits = new Map();
  return function take(key, now = Date.now()) {
    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    // Opportunistic cleanup so the map doesn't grow forever.
    if (hits.size > 5000) {
      for (const [k, e] of hits) if (now >= e.resetAt) hits.delete(k);
    }
    return { allowed: entry.count <= max, remaining: Math.max(0, max - entry.count), resetAt: entry.resetAt };
  };
}

/** Express middleware: rate-limit by a key (default: client IP). */
export function rateLimit(limiter, keyFn = (req) => req.ip || req.socket?.remoteAddress || "unknown") {
  return (req, res, next) => {
    const { allowed, remaining, resetAt } = limiter(keyFn(req));
    res.setHeader("X-RateLimit-Remaining", remaining);
    if (!allowed) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
      return res.status(429).json({ error: "Too many requests — please slow down and try again shortly." });
    }
    next();
  };
}

/**
 * Sensible security headers for an app that serves its own HTML + JSON API.
 * When Clerk auth is enabled, pass its frontend-API origin so the CSP admits
 * ClerkJS, its API calls, avatars, and the bot-protection challenge frame.
 */
export function createSecurityHeaders({ clerkOrigin } = {}) {
  const csp = [
    "default-src 'self'",
    `img-src 'self' data: blob:${clerkOrigin ? " https://img.clerk.com" : ""}`,
    "media-src 'self' blob: https:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self'${clerkOrigin ? ` ${clerkOrigin} https://challenges.cloudflare.com` : ""}`,
    `connect-src 'self'${clerkOrigin ? ` ${clerkOrigin}` : ""}`,
    `worker-src 'self'${clerkOrigin ? " blob:" : ""}`,
    `frame-src 'self'${clerkOrigin ? " https://challenges.cloudflare.com" : ""}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
  ].join("; ");

  return function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(self), camera=()");
    res.setHeader("Content-Security-Policy", csp);
    next();
  };
}

/** Default headers middleware (no Clerk origins). */
export const securityHeaders = createSecurityHeaders();
