import { logger } from "./logger";

// Live news for travellers — aggregated from free, key-less public RSS feeds and
// parsed deterministically (no LLM, no paid API, no per-request cost). Results
// are cached in-process for 15 minutes, so a burst of readers hits the cache,
// not the upstream feeds. Two lanes: "world" (stay aware) and "travel"
// (disruruption, transport, aviation). Never throws — a dead feed is skipped and
// the rest still render.

export type NewsCategory = "world" | "travel";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null; // ISO
  category: NewsCategory;
  disruption: boolean; // travel-affecting (strike, airspace, weather, …)
}

// Deterministic travel-disruption classifier — a keyword pass over the headline.
// No LLM: it's fast, free, and predictable. Deliberately travel-centric so it
// surfaces things that actually change a trip (strikes, airspace, extreme
// weather, border/visa changes), not general bad news.
const DISRUPTION_RE =
  /\b(strike|walkout|industrial action|air ?traffic|atc|airspace|grounded|cancel(?:led|s|ing)?|delays?|airport|aviation|flights?|runway|volcan|eruption|ash cloud|hurricane|typhoon|cyclone|storm|blizzard|snowstorm|heatwave|wildfire|flood(?:s|ing)?|earthquake|border closure|visa|passport|curfew|lockdown|evacuat|unrest|no-fly)\b/i;

export function isDisruption(title: string): boolean {
  return DISRUPTION_RE.test(title);
}

interface Feed {
  url: string;
  source: string;
  category: NewsCategory;
}

// Stable, long-lived public RSS feeds. Adding/removing a feed is a one-line
// change; no keys, no accounts.
const FEEDS: Feed[] = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC News", category: "world" },
  { url: "https://www.theguardian.com/world/rss", source: "The Guardian", category: "world" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", source: "BBC Business", category: "world" },
  { url: "https://www.theguardian.com/uk/travel/rss", source: "Guardian Travel", category: "travel" },
  { url: "https://feeds.bbci.co.uk/news/health/rss.xml", source: "BBC Health", category: "world" },
];

const CACHE_TTL_MS = 15 * 60 * 1000;
let cache: { items: NewsItem[]; ts: number } | null = null;
let inflight: Promise<NewsItem[]> | null = null;

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "") // strip any stray HTML in titles
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
    .trim();
}

function pick(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

// Parse RSS 2.0 <item> blocks (the format all the feeds above use). Tolerant by
// design: anything it can't read is skipped rather than throwing.
function parseFeed(xml: string, feed: Feed): NewsItem[] {
  const out: NewsItem[] = [];
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of items) {
    const title = pick(block, "title");
    const link = pick(block, "link");
    if (!title || !link || !/^https?:\/\//.test(link)) continue;
    const pub = pick(block, "pubDate") ?? pick(block, "dc:date");
    let publishedAt: string | null = null;
    if (pub) {
      const d = new Date(pub);
      if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
    }
    out.push({ title, link, source: feed.source, publishedAt, category: feed.category, disruption: isDisruption(title) });
  }
  return out;
}

async function fetchFeed(feed: Feed): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": "HOLTO/1.0 (+https://holtotravel.com)" },
    });
    if (!res.ok) throw new Error(`news feed HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml, feed);
  } catch (err) {
    logger.warn({ err, feed: feed.url }, "News feed fetch/parse failed");
    return [];
  }
}

async function refresh(): Promise<NewsItem[]> {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const merged = results.flat();

  // De-dupe by link, then newest first (undated items sink to the bottom).
  const seen = new Set<string>();
  const deduped = merged.filter((it) => (seen.has(it.link) ? false : (seen.add(it.link), true)));
  deduped.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  cache = { items: deduped, ts: Date.now() };
  return deduped;
}

// Returns the merged, cached news list. `category` optionally filters; `limit`
// caps the count (default 40).
export async function getNews(category?: NewsCategory, limit = 40): Promise<NewsItem[]> {
  if (!cache || Date.now() - cache.ts > CACHE_TTL_MS) {
    // Collapse concurrent refreshes into one upstream fetch.
    inflight ??= refresh().finally(() => {
      inflight = null;
    });
    try {
      await inflight;
    } catch {
      /* refresh guards itself; fall through to whatever cache exists */
    }
  }
  const items = cache?.items ?? [];
  const filtered = category ? items.filter((i) => i.category === category) : items;
  return filtered.slice(0, limit);
}

// Exposed for unit testing the parser without network.
export const __test = { parseFeed, decodeEntities };
