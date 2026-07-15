import { logger } from "./logger";

// Visa & entry guidance. The requirement matrix comes from the free, MIT-
// licensed Passport Index dataset (passport → destination → requirement),
// fetched live and cached. That dataset is community-maintained and updated
// periodically — it is NOT a legal authority and can lag real rule changes.
//
// Because getting this wrong can strand a traveller, the guidance is always
// paired (in the API response) with a link to the authoritative official
// source, and the whole thing degrades safely: if the dataset can't be loaded
// or parsed, we return no guidance rather than a guess, and the client shows
// the official links only.

// Override with a fresher mirror via env without a code change.
const DATASET_URL =
  process.env.VISA_DATASET_URL ??
  "https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-tidy-iso2.csv";

const TTL_MS = 24 * 60 * 60 * 1000;
let cache: { matrix: Map<string, Map<string, string>>; ts: number } | null = null;
let inflight: Promise<Map<string, Map<string, string>> | null> | null = null;

export type VisaCategory =
  | "visa_free"
  | "visa_on_arrival"
  | "eta"
  | "e_visa"
  | "visa_required"
  | "no_admission";

export interface VisaRequirement {
  category: VisaCategory;
  allowedDays: number | null; // for visa-free stays, when known
  label: string; // short human label
  detail: string; // one plain-English sentence
  tone: "good" | "warn" | "bad";
}

// Map a raw Passport Index requirement cell to our normalised shape. The cell is
// either an integer (visa-free days) or one of a small set of phrases.
export function normalizeRequirement(raw: string): VisaRequirement | null {
  const v = raw.trim().toLowerCase();
  if (!v || v === "-1") return null; // blank or "same country" marker

  const asNum = Number(v);
  if (Number.isFinite(asNum) && /^\d+$/.test(v)) {
    return {
      category: "visa_free",
      allowedDays: asNum,
      label: `Visa-free · up to ${asNum} days`,
      detail: `Visa-free entry for stays of up to ${asNum} days. Your passport must usually be valid for at least 6 months.`,
      tone: "good",
    };
  }
  if (v.includes("visa free") || v === "visa-free") {
    return { category: "visa_free", allowedDays: null, label: "Visa-free", detail: "Visa-free entry for short stays. Check the exact day limit before you travel.", tone: "good" };
  }
  if (v.includes("arrival")) {
    return { category: "visa_on_arrival", allowedDays: null, label: "Visa on arrival", detail: "You can get a visa on arrival — carry the fee (often cash) and any required documents.", tone: "good" };
  }
  if (v === "eta" || v.includes("electronic travel")) {
    return { category: "eta", allowedDays: null, label: "eTA required", detail: "You need an electronic travel authorisation (eTA) approved online before you fly.", tone: "warn" };
  }
  if (v.includes("e-visa") || v.includes("evisa") || v.includes("e visa")) {
    return { category: "e_visa", allowedDays: null, label: "e-Visa required", detail: "You need an e-Visa — apply online and get approval before you travel.", tone: "warn" };
  }
  if (v.includes("no admission") || v.includes("banned") || v.includes("ban")) {
    return { category: "no_admission", allowedDays: null, label: "Entry not permitted", detail: "Entry is generally not permitted on this passport. Check the official source for any exceptions.", tone: "bad" };
  }
  if (v.includes("visa required") || v.includes("visa") ) {
    return { category: "visa_required", allowedDays: null, label: "Visa required", detail: "You need a visa arranged in advance, usually before you fly. Apply early.", tone: "bad" };
  }
  return null;
}

async function loadMatrix(): Promise<Map<string, Map<string, string>> | null> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.matrix;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(DATASET_URL, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`visa dataset HTTP ${res.status}`);
      const text = await res.text();
      const matrix = parseTidyCsv(text);
      if (matrix.size === 0) throw new Error("visa dataset parsed empty");
      cache = { matrix, ts: Date.now() };
      return matrix;
    } catch (err) {
      logger.warn({ err }, "visa dataset load failed; guidance unavailable, official links only");
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// Parse the "tidy" CSV: Passport,Destination,Requirement (ISO-2 codes).
export function parseTidyCsv(text: string): Map<string, Map<string, string>> {
  const matrix = new Map<string, Map<string, string>>();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < 3) continue;
    const from = parts[0].trim().toUpperCase();
    const to = parts[1].trim().toUpperCase();
    const req = parts.slice(2).join(",").trim();
    if (from.length !== 2 || to.length !== 2) continue; // skips the header row too
    let row = matrix.get(from);
    if (!row) {
      row = new Map<string, string>();
      matrix.set(from, row);
    }
    row.set(to, req);
  }
  return matrix;
}

// Guidance for travelling on `fromCode` passport to `toCode`. Null when the
// dataset is unavailable or has no entry — callers then show official links.
export async function getVisaRequirement(fromCode: string, toCode: string): Promise<VisaRequirement | null> {
  const from = fromCode.trim().toUpperCase();
  const to = toCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(from) || !/^[A-Z]{2}$/.test(to)) return null;
  if (from === to) {
    return { category: "visa_free", allowedDays: null, label: "Your own country", detail: "This is your passport's country — no visa needed to enter.", tone: "good" };
  }
  const matrix = await loadMatrix();
  const raw = matrix?.get(from)?.get(to);
  if (raw == null) return null;
  return normalizeRequirement(raw);
}

// True when we have a usable dataset loaded/loadable (best-effort, non-throwing).
export async function visaDataAvailable(): Promise<boolean> {
  const m = await loadMatrix();
  return !!m && m.size > 0;
}

// Current cache state without forcing a fetch — for the admin data-health view.
export function visaStatus(): { loaded: boolean; passports?: number; ageMinutes?: number } {
  if (!cache) return { loaded: false };
  return { loaded: true, passports: cache.matrix.size, ageMinutes: Math.round((Date.now() - cache.ts) / 60000) };
}

// ── Official, authoritative sources (always shown) ──────────────────────────
// The dataset is guidance; these links are the authority the user should act on.

export interface OfficialLink {
  label: string;
  url: string;
}

// gov.uk foreign-travel-advice slugs differ from our display names in a few
// cases; map the exceptions, otherwise derive from the name.
const GOVUK_SLUG: Record<string, string> = {
  TR: "turkey",
  CZ: "czech-republic",
  US: "usa",
  AE: "united-arab-emirates",
  KR: "south-korea",
  VN: "vietnam",
  GE: "georgia",
  RU: "russia",
};

// The gov.uk Foreign Office travel-advice page for a destination — authoritative
// and current, covering both safety alerts and entry requirements. Reused by the
// visa checker and the travel-alerts tool.
export function govUkAdviceUrl(destCode: string, destName: string): string {
  return `https://www.gov.uk/foreign-travel-advice/${govUkSlug(destCode, destName)}`;
}

function govUkSlug(destCode: string, destName: string): string {
  return (
    GOVUK_SLUG[destCode] ??
    destName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

// Traveller's own government travel-advice landing pages (authoritative, current).
const GOV_ADVICE: Record<string, { label: string; url: string }> = {
  US: { label: "US State Dept — country information", url: "https://travel.state.gov/content/travel/en/international-travel.html" },
  AU: { label: "Australia — Smartraveller", url: "https://www.smartraveller.gov.au/destinations" },
  CA: { label: "Canada — travel advice", url: "https://travel.gc.ca/travelling/advisories" },
  IE: { label: "Ireland — travel advice", url: "https://www.ireland.ie/en/dfa/overseas-travel/travel-advice/" },
  NZ: { label: "New Zealand — SafeTravel", url: "https://www.safetravel.govt.nz/" },
};

export function officialSources(passportCode: string, destCode: string, destName: string): OfficialLink[] {
  const links: OfficialLink[] = [];
  // gov.uk has an authoritative "entry requirements" section for every country
  // and is directly linkable per-destination — the primary reference.
  links.push({
    label: "UK Foreign Office — entry requirements",
    url: `${govUkAdviceUrl(destCode, destName)}/entry-requirements`,
  });
  // Plus the traveller's own government, where we have a reliable landing page.
  const own = GOV_ADVICE[passportCode.trim().toUpperCase()];
  if (own) links.push(own);
  return links;
}
