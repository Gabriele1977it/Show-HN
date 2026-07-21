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

// Flatten one country's operators/packages into our normalised shape.
function normalisePackages(country: AwCountry): EsimPackage[] {
  const out: EsimPackage[] = [];
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
  out.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  return out;
}

// The full normalised package list for a country (cheapest first), cached.
async function fetchCountryPackages(code: string): Promise<EsimPackage[]> {
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
    for (const country of json.data ?? []) out.push(...normalisePackages(country));
    out.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    cache.set(code, { data: out, ts: Date.now() });
    return out;
  } catch (err) {
    logger.warn({ err, code }, "Airalo packages errored");
    return [];
  }
}

// Sync the whole local catalogue from GET /v2/packages. Airalo asks partners to
// hit this endpoint at least once an hour so they never serve retired or
// out-of-stock plans; the on-demand per-country fetch alone leaves quiet hours
// with no sync at all. The monitor worker calls this hourly. It pages through
// the full list, warms the per-country cache (so live lookups stay instant and
// consistent), and returns a count. Never throws; a no-op until configured.
export async function syncAllPackages(): Promise<{ countries: number; packages: number }> {
  if (!airaloConfigured()) return { countries: 0, packages: 0 };
  const token = await getToken();
  if (!token) return { countries: 0, packages: 0 };

  const MAX_PAGES = 30; // safety cap against a runaway pagination loop
  const fresh = new Map<string, EsimPackage[]>();
  let countries = 0;
  let packages = 0;
  let page = 1;

  try {
    for (; page <= MAX_PAGES; page += 1) {
      const url = `${BASE}/v2/packages?filter[type]=local&limit=100&page=${page}`;
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.warn({ status: res.status, page, body: body.slice(0, 300) }, "Airalo package sync page failed");
        break;
      }
      const json = (await res.json()) as { data?: AwCountry[]; meta?: { last_page?: number } };
      const data = json.data ?? [];
      if (data.length === 0) break;
      for (const country of data) {
        const code = (country.country_code ?? "").trim().toUpperCase();
        const list = normalisePackages(country);
        if (/^[A-Z]{2}$/.test(code)) fresh.set(code, list);
        countries += 1;
        packages += list.length;
      }
      const lastPage = json.meta?.last_page;
      if (lastPage && page >= lastPage) break;
    }
    // Swap the freshly-synced lists into the cache in one go.
    const ts = Date.now();
    for (const [code, list] of fresh) cache.set(code, { data: list, ts });
    logger.info({ countries, packages, pages: page }, "Airalo package catalogue synced");
  } catch (err) {
    logger.warn({ err }, "Airalo package sync errored");
  }
  return { countries, packages };
}

// Data packages to show for a country (cheapest six).
export async function getEsimPackages(countryCode: string): Promise<EsimPackage[]> {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return [];
  return (await fetchCountryPackages(code)).slice(0, 6);
}

// Look up one package (for checkout — we need its exact price server-side rather
// than trusting a client-supplied amount).
export async function findPackage(countryCode: string, packageId: string): Promise<EsimPackage | null> {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || !packageId) return null;
  return (await fetchCountryPackages(code)).find((p) => p.id === packageId) ?? null;
}

export interface PlacedEsim {
  airaloOrderId: string;
  iccid: string | null;
  qrCodeUrl: string | null;
  lpa: string | null;
}

interface AwOrderSim {
  iccid?: string;
  lpa?: string;
  qrcode?: string;
  qrcode_url?: string;
}
interface AwOrderResponse {
  data?: { id?: string | number; code?: string; sims?: AwOrderSim[] };
}

// Place an Airalo order for one eSIM of a package. This spends the partner's
// Airalo balance — only ever call it AFTER payment is confirmed. Returns the
// eSIM details (ICCID + QR) or null on failure.
export async function placeOrder(packageId: string, description: string): Promise<PlacedEsim | null> {
  const token = await getToken();
  if (!token || !packageId) return null;
  try {
    const res = await fetch(`${BASE}/v2/orders`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ package_id: packageId, quantity: "1", type: "sim", description: description.slice(0, 255) }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error({ status: res.status, packageId, body: body.slice(0, 400) }, "Airalo order failed");
      return null;
    }
    const json = (await res.json()) as AwOrderResponse;
    const sim = json.data?.sims?.[0];
    return {
      airaloOrderId: String(json.data?.id ?? json.data?.code ?? ""),
      iccid: sim?.iccid ?? null,
      qrCodeUrl: sim?.qrcode_url ?? null,
      lpa: sim?.lpa ?? sim?.qrcode ?? null,
    };
  } catch (err) {
    logger.error({ err, packageId }, "Airalo order errored");
    return null;
  }
}
