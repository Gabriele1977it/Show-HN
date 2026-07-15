import { logger } from "./logger";

// AwardWallet Account Access API integration (free tier — no business
// subscription needed for balances; only itinerary download requires it, per
// AwardWallet). Auth is an API key sent in the `X-Authentication` header. The
// user first authorises HOLTO from AwardWallet's connect page (AWARDWALLET_CONNECT_URL);
// they then appear under our business account and we pull the loyalty accounts
// they chose to share. We can read balances but cannot trigger a refresh — the
// user keeps their data current in AwardWallet (a documented limitation).
//
// Everything here is dormant until AWARDWALLET_API_KEY is set, so the feature
// ships safe and simply stays hidden when unconfigured.

const BASE = "https://business.awardwallet.com/api/export/v1";

export function awardwalletConfigured(): boolean {
  return !!process.env.AWARDWALLET_API_KEY;
}

// Static fallback connect URL (used only if the dynamic create-auth-url call
// can't be reached or is misconfigured).
export function awardwalletConnectUrl(): string | null {
  return process.env.AWARDWALLET_CONNECT_URL?.trim() || null;
}

// Generate a per-user authorisation URL via AwardWallet's "create auth url"
// endpoint (per their approval email: the connect URL is returned by this call).
// `state` is our own user id, echoed back so a connection can be tied to the
// right HOLTO account. The endpoint path defaults to the documented /authUser
// but can be overridden with AWARDWALLET_AUTHURL_PATH without a code change. Any
// failure falls back to the static connect URL, so the button always works.
export async function createAuthUrl(state?: string): Promise<string | null> {
  const key = process.env.AWARDWALLET_API_KEY;
  if (!key) return null;
  const path = process.env.AWARDWALLET_AUTHURL_PATH?.trim() || "/authUser";
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: { "X-Authentication": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(state ? { state } : {}),
    });
    if (!res.ok) {
      logger.warn({ status: res.status, path }, "AwardWallet create-auth-url non-OK; using static fallback");
      return awardwalletConnectUrl();
    }
    const data = (await res.json()) as { url?: string; authUrl?: string; authURL?: string } | string;
    const url = typeof data === "string" ? data : data.url ?? data.authUrl ?? data.authURL ?? null;
    return url || awardwalletConnectUrl();
  } catch (err) {
    logger.warn({ err, path }, "AwardWallet create-auth-url failed; using static fallback");
    return awardwalletConnectUrl();
  }
}

async function call<T>(path: string): Promise<T | null> {
  const key = process.env.AWARDWALLET_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: AbortSignal.timeout(12000),
      headers: { "X-Authentication": key, accept: "application/json" },
    });
    if (!res.ok) {
      logger.warn({ status: res.status, path }, "AwardWallet API non-OK");
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    logger.warn({ err, path }, "AwardWallet API request failed");
    return null;
  }
}

interface AwConnectedUser {
  userId?: number;
  userName?: string;
  email?: string;
  accessLevel?: string;
}

interface AwAccount {
  accountId?: number;
  code?: string; // provider code
  displayName?: string; // "British Airways Executive Club"
  kind?: string; // airline | hotel | ...
  balance?: string; // formatted, e.g. "45,120"
  balanceRaw?: number; // numeric
  owner?: string;
  loginRequired?: boolean;
  properties?: { name?: string; rank?: number; value?: string }[];
  expirationDate?: string;
}

// A normalised loyalty account ready to upsert into loyaltyProgramsTable.
export interface NormalisedAccount {
  category: string; // airline | hotel | rail | car | card | other
  programName: string;
  membershipNumber: string | null;
  tier: string | null;
  pointsBalance: number | null;
  expiresAt: string | null; // YYYY-MM-DD
}

function mapCategory(kind: string | undefined, displayName: string): string {
  const s = `${kind ?? ""} ${displayName}`.toLowerCase();
  if (/(airline|air |airways|flying|mileage|miles|skymiles|aadvantage|avios)/.test(s)) return "airline";
  if (/(hotel|hilton|marriott|hyatt|bonvoy|ihg|accor|wyndham|resort)/.test(s)) return "hotel";
  if (/(rail|train|amtrak|eurostar|trainline)/.test(s)) return "rail";
  if (/(car|hertz|avis|europcar|enterprise|sixt|rental)/.test(s)) return "car";
  if (/(card|amex|visa|mastercard|chase|barclay|bank|credit)/.test(s)) return "card";
  return "other";
}

function findMembership(props: AwAccount["properties"]): string | null {
  if (!Array.isArray(props)) return null;
  const hit = props.find((p) => /member|account|number|login|card/i.test(p.name ?? ""));
  return hit?.value?.trim() || null;
}

function findTier(props: AwAccount["properties"]): string | null {
  if (!Array.isArray(props)) return null;
  const hit = props.find((p) => /(level|tier|status|elite)/i.test(p.name ?? ""));
  return hit?.value?.trim() || null;
}

function toIsoDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function normaliseAccount(a: AwAccount): NormalisedAccount | null {
  const programName = a.displayName?.trim();
  if (!programName) return null;
  let points: number | null = null;
  if (typeof a.balanceRaw === "number" && Number.isFinite(a.balanceRaw)) {
    points = Math.round(a.balanceRaw);
  } else if (a.balance) {
    const n = Number(a.balance.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) points = Math.round(n);
  }
  return {
    category: mapCategory(a.kind, programName),
    programName,
    membershipNumber: findMembership(a.properties),
    tier: findTier(a.properties),
    pointsBalance: points,
    expiresAt: toIsoDate(a.expirationDate),
  };
}

// List the users who have connected their AwardWallet to our business account.
export async function listConnectedUsers(): Promise<AwConnectedUser[]> {
  const data = await call<{ connectedUsers?: AwConnectedUser[] } | AwConnectedUser[]>("/connectedUsers");
  if (!data) return [];
  return Array.isArray(data) ? data : (data.connectedUsers ?? []);
}

// Fetch the shared loyalty accounts for one connected AwardWallet user.
export async function getConnectedUserAccounts(userId: number): Promise<NormalisedAccount[]> {
  const data = await call<{ accounts?: AwAccount[] }>(`/connectedUser/${userId}`);
  const accounts = data?.accounts ?? [];
  return accounts.map(normaliseAccount).filter((a): a is NormalisedAccount => a !== null);
}

// Best-effort: resolve a HOLTO user's AwardWallet userId by matching email among
// the connected users (they authorise with the same email they use in HOLTO).
export async function findConnectedUserIdByEmail(email: string): Promise<number | null> {
  const target = email.trim().toLowerCase();
  const users = await listConnectedUsers();
  const hit = users.find((u) => (u.email ?? "").trim().toLowerCase() === target);
  return hit?.userId ?? null;
}

// ── Members ──────────────────────────────────────────────────────────────────
// "Members" are users added directly to the business account (no invite/connect
// approval needed), which is handy for testing before AwardWallet approves the
// public connect flow. Same account shape as connected users.

interface AwMember {
  userId?: number;
  id?: number;
  email?: string;
  userName?: string;
  fullName?: string;
  accounts?: AwAccount[];
}

export async function listMembers(): Promise<AwMember[]> {
  const data = await call<{ members?: AwMember[] } | AwMember[]>("/members");
  if (!data) return [];
  return Array.isArray(data) ? data : (data.members ?? []);
}

// Return the shared loyalty accounts for the member matching this email (or, if
// there's exactly one member, that one). Empty if none / not yet approved.
export async function getMemberAccountsByEmail(email: string): Promise<NormalisedAccount[]> {
  const target = email.trim().toLowerCase();
  if (!target) return [];
  const members = await listMembers();
  // Strict email match only — never fall back to "the only member", which would
  // leak one member's balances to any user during single-member testing.
  const match = members.find((m) => (m.email ?? "").trim().toLowerCase() === target);
  const accounts = match?.accounts ?? [];
  return accounts.map(normaliseAccount).filter((a): a is NormalisedAccount => a !== null);
}
