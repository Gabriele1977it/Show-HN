// Tiny in-memory per-key sliding-window rate limiter. Not durable across
// restarts or multiple instances, but enough to stop a single client from
// running up the AI bill in a burst. For hard, durable quotas use a DB counter
// (see lib/usage.ts for the daily flight-search pattern).

const hits = new Map<string, number[]>();

// Returns true if the action is allowed (and records it); false if the key has
// used up `max` actions within the last `windowMs`.
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Opportunistic cleanup so the map can't grow unbounded with idle keys.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}
