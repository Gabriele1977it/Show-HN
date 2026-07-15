import { logger } from "./logger";
import { codeForName } from "./countries";
import type { RiskLevel } from "./high-risk";

// Automated high-risk source: the US State Department's official travel-advisory
// feed. It publishes a level 1–4 per country (1 = normal precautions,
// 4 = do not travel) and updates itself as the situation changes — so the app's
// safety escalation stays current with no manual upkeep.
//
// We only care about the serious end: Level 3 → "high" (reconsider travel),
// Level 4 → "extreme" (do not travel). Levels 1–2 don't escalate anything.
// Parsed defensively; on any failure we return an empty map and the caller falls
// back to the curated backstop list.

const FEED_URL = process.env.STATE_DEPT_FEED_URL ?? "https://travel.state.gov/_res/rss/TAsTWs.xml";
const TTL_MS = 6 * 60 * 60 * 1000;

export interface StateDeptEntry {
  level: RiskLevel;
  levelNum: number;
  updated: string | null;
}

let cache: { map: Map<string, StateDeptEntry>; ts: number } | null = null;
let inflight: Promise<Map<string, StateDeptEntry>> | null = null;

// Parse the advisories RSS into code → { level }. Exported for testing.
export function parseStateDeptFeed(xml: string): Map<string, StateDeptEntry> {
  const map = new Map<string, StateDeptEntry>();
  const items = xml.split(/<item[ >]/i).slice(1);
  for (const item of items) {
    const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
    if (!titleMatch) continue;
    let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    // Level appears somewhere in the item (category/title/description).
    const levelMatch = item.match(/Level\s*([1-4])/i);
    if (!levelMatch) continue;
    const levelNum = Number(levelMatch[1]);
    if (levelNum < 3) continue; // only 3/4 escalate

    const country = title.replace(/\s*[-–]?\s*Travel Advisory\s*$/i, "").trim();
    const code = codeForName(country);
    if (!code) continue;

    const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    let updated: string | null = null;
    if (dateMatch) {
      const d = new Date(dateMatch[1].trim());
      if (!Number.isNaN(d.getTime())) updated = d.toISOString().slice(0, 10);
    }

    const level: RiskLevel = levelNum >= 4 ? "extreme" : "high";
    const existing = map.get(code);
    // Keep the most severe if a country appears more than once.
    if (!existing || levelNum > existing.levelNum) map.set(code, { level, levelNum, updated });
  }
  return map;
}

async function load(): Promise<Map<string, StateDeptEntry>> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.map;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`State Dept feed HTTP ${res.status}`);
      const xml = await res.text();
      const map = parseStateDeptFeed(xml);
      if (map.size === 0) throw new Error("State Dept feed parsed empty");
      cache = { map, ts: Date.now() };
      return map;
    } catch (err) {
      logger.warn({ err }, "State Dept advisory feed failed; using curated backstop");
      // Cache an empty map briefly so we don't hammer a failing feed.
      cache = { map: new Map(), ts: Date.now() - TTL_MS + 15 * 60 * 1000 };
      return cache.map;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// Auto-derived risk level for a country from the live State Dept feed, or null.
export async function stateDeptRisk(code: string): Promise<StateDeptEntry | null> {
  const map = await load();
  return map.get(code.trim().toUpperCase()) ?? null;
}
