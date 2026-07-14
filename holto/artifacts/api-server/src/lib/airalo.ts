import { logger } from "./logger";

// Airalo Partner API — eSIM data plans for travellers. Phase 1 is read-only:
// authenticate with client credentials (token cached ~24h) and list the data
// packages for a destination country. Ordering/fulfilment (which spends the
// partner's Airalo balance) is deliberately NOT here — that needs a payment
// decision. Dormant until AIRALO_CLIENT_ID / AIRALO_CLIENT_SECRET are set, so it
// ships safe. Never throws — any failure yields an empty list and the UI hides.

const BASE = (process.env.AIRALO_BASE_URL ?? "https://partners-api.airalo.com").replace(/\/+$/, "");

export function airaloConfigured(): boolean {
  return !!(process.env.AIRALO_CLIENT_ID && process.env.AIRALO_CLIENT_SECRET);
}

// ── Token (cached in-process) ────────────────────────────────────────────────
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  const id = process.env.AIRALO_CLIENT_ID;
  const secret = process.env.AIRALO_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;

  try {
    const res = await fetch(`${BASE}/v2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body: body.slice(0, 300) }, "Airalo token request failed");
      return null;
    }
    const json = (await res.json()) as { data?: { access_token?: string; expires_in?: number }; access_token?: string; expires_in?: number };
    const token = json.data?.access_token ?? json.access_token;
    const expiresIn = json.data?.expires_in ?? json.expires_in ?? 24 * 60 * 60;
    if (!token) return null;
    tokenCache = { token, expiresAt: Date.now() + expiresIn * 1000 };
    return token;
  } catch (err) {
    logger.warn({ err }, "Airalo token request errored");
    return null;
  }
}

// ── Packages ─────────────────────────────────────────────────────────────────
export interface EsimPackage {
  id: string;
  operator: string;
  title: string;
  data: string; // "1 GB" or "Unlimited"
  days: number | null;
  price: number | null;
  currency: string;
}

interface AwPrices {
  recommended_retail_price?: Record<string, number>;
  net_price?: Record<string, number>;
}
interface AwPackage {
  id?: string | number;
  title?: string;
  data?: string;
  amount?: number; // MB
  day?: number;
  is_unlimited?: boolean;
  price?: number;
  prices?: AwPrices;
}
interface AwOperator {
  title?: string;
  packages?: AwPackage[];
}
interface AwCountry {
  country_code?: string;
  title?: string;
  operators?: AwOperator[];
}

function formatData(pkg: AwPackage): string {
  if (pkg.is_unlimited) return "Unlimited";
  if (pkg.data) return pkg.data;
  if (typeof pkg.amount === "number") {
    return pkg.amount >= 1000 ? `${(pkg.amount / 1000).toFixed(pkg.amount % 1000 ? 1 : 0)} GB` : `${pkg.amount} MB`;
  }
  return pkg.title ?? "Data plan";
}

function pickPrice(pkg: AwPackage): { price: number | null; currency: string } {
  const rrp = pkg.prices?.recommended_retail_price;
  if (rrp?.GBP != null) return { price: rrp.GBP, currency: "GBP" };
  if (rrp?.USD != null) return { price: rrp.USD, currency: "USD" };
  if (typeof pkg.price === "number") return { price: pkg.price, currency: "USD" };
  return { price: null, currency: "USD" };
}

const cache = new Map<string, { data: EsimPackage[]; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // Airalo asks for at most one call/hour.

// Data packages available for a two-letter country code, cheapest first.
export async function getEsimPackages(countryCode: string): Promise<EsimPackage[]> {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return [];
  const hit = cache.get(code);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  const token = await getToken();
  if (!token) return [];

  try {
    const url = `${BASE}/v2/packages?filter[type]=local&filter[country]=${code}&limit=1`;
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, code, body: body.slice(0, 300) }, "Airalo packages request failed");
      return [];
    }
    const json = (await res.json()) as { data?: AwCountry[] };
    const out: EsimPackage[] = [];
    for (const country of json.data ?? []) {
      for (const op of country.operators ?? []) {
        for (const pkg of op.packages ?? []) {
          const { price, currency } = pickPrice(pkg);
          out.push({
            id: String(pkg.id ?? ""),
            operator: op.title ?? "Airalo",
            title: pkg.title ?? formatData(pkg),
            data: formatData(pkg),
            days: pkg.day ?? null,
            price,
            currency,
          });
        }
      }
    }
    out.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    const top = out.slice(0, 6);
    cache.set(code, { data: top, ts: Date.now() });
    return top;
  } catch (err) {
    logger.warn({ err, code }, "Airalo packages errored");
    return [];
  }
}
