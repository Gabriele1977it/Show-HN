// Pure flight-number / status helpers with no imports, so they are safe to unit
// test under Node's native type-stripping and reusable anywhere.

export type FlightStatus =
  | "scheduled"
  | "delayed"
  | "active"
  | "landed"
  | "cancelled"
  | "incident"
  | "diverted"
  | "unknown";

// Map common ICAO airline prefixes → IATA codes so users can enter either format.
// AirLabs uses IATA codes in flight_iata queries.
const ICAO_TO_IATA: Record<string, string> = {
  EZY: "U2",  // easyJet
  RYR: "FR",  // Ryanair
  BAW: "BA",  // British Airways
  EIN: "EI",  // Aer Lingus
  WZZ: "W6",  // Wizz Air
  KLM: "KL",  // KLM
  AFR: "AF",  // Air France
  DLH: "LH",  // Lufthansa
  THY: "TK",  // Turkish Airlines
  UAE: "EK",  // Emirates
  QTR: "QR",  // Qatar Airways
  ETD: "EY",  // Etihad
  MSR: "MS",  // EgyptAir
  PGT: "PC",  // Pegasus
  IBE: "IB",  // Iberia
  VIR: "VS",  // Virgin Atlantic
  SWR: "LX",  // Swiss
  AUA: "OS",  // Austrian
  BEL: "SN",  // Brussels Airlines
  TAP: "TP",  // TAP Portugal
};

// A link to the authoritative live status for a flight. Google's flight-status
// panel is free, universal, and pulls current data (incl. the airline's own
// figures) — so travellers always have a one-tap way to verify against the
// source of truth, whatever our feed says.
export function officialStatusUrl(flightNumber: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${flightNumber} flight status`)}`;
}

export function candidateFlightNumbers(fn: string): string[] {
  const match = fn.match(/^([A-Z]{2,3})(\d+[A-Z]?)$/);
  if (!match) return [fn];
  const [, prefix, num] = match;
  const iata = ICAO_TO_IATA[prefix];
  // Return both versions: the original and the IATA-converted one
  return iata && iata !== prefix ? [fn, iata + num] : [fn];
}

export function mapStatus(raw: string | undefined): FlightStatus {
  const s = (raw ?? "").toLowerCase().trim();
  // Normalise the various provider spellings onto our set.
  if (s === "en-route" || s === "en route" || s === "airborne") return "active";
  if (s === "redirected") return "diverted";
  const valid = ["scheduled", "delayed", "active", "landed", "cancelled", "incident", "diverted"];
  return valid.includes(s) ? (s as FlightStatus) : "unknown";
}

// Minutes between two ISO/date-ish strings (b − a), or null if unparseable.
export function minutesBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round((tb - ta) / 60000);
}

// The effective departure delay in minutes — the largest of the provider's own
// delay figure and the gap between the scheduled time and any estimated/actual
// time. This catches delays the provider's status string hasn't caught up with.
export function effectiveDelayMinutes(
  providerDelay: number | null,
  scheduledDep: string | null,
  estimatedDep: string | null,
  actualDep: string | null,
): number | null {
  const candidates: number[] = [];
  if (typeof providerDelay === "number" && Number.isFinite(providerDelay)) candidates.push(providerDelay);
  const est = minutesBetween(scheduledDep, estimatedDep);
  if (est != null) candidates.push(est);
  const act = minutesBetween(scheduledDep, actualDep);
  if (act != null) candidates.push(act);
  if (!candidates.length) return null;
  return Math.max(...candidates);
}

// The delay (minutes) at or above which we call a flight "delayed". Matches the
// EU/UK261 mental model where short slips aren't worth alarming about.
export const DELAY_THRESHOLD_MIN = 15;

// Derive the status the traveller should actually see. Terminal / in-air states
// from the provider are authoritative and kept as-is; otherwise, if the
// effective delay crosses the threshold, we surface "delayed" even when the
// provider still says "scheduled".
export function deriveStatus(providerStatus: FlightStatus, effDelay: number | null): FlightStatus {
  if (["cancelled", "diverted", "incident", "landed", "active"].includes(providerStatus)) {
    return providerStatus;
  }
  if (effDelay != null && effDelay >= DELAY_THRESHOLD_MIN) return "delayed";
  return providerStatus; // scheduled / unknown
}

// A calm, warm, human status line — computed deterministically (no LLM), so it's
// free, instant, and works offline. This is called on every flight lookup, so
// keeping it out of the paid AI path matters. Tone-only, never invents facts.
export function friendlyStatusMessage(
  status: FlightStatus,
  depDelay: number | null,
  depGate: string | null,
  depTerminal: string | null,
): string {
  const where = [depTerminal ? `Terminal ${depTerminal}` : null, depGate ? `gate ${depGate}` : null]
    .filter(Boolean)
    .join(", ");

  switch (status) {
    case "cancelled":
      return "This flight is showing as cancelled. Check your rights — you may be owed a refund or rebooking, and possibly compensation.";
    case "diverted":
      return "This flight has been diverted. Tap through for your options and what you may be owed.";
    case "incident":
      return "There's a disruption reported on this flight. I'll help you work out your next steps and rights.";
    case "landed":
      return "Landed safely. Welcome — safe onward travels. 👋";
    case "active":
      return "You're in the air — arrival details will firm up as the flight progresses.";
    case "delayed":
      return `Now showing a delay${depDelay != null && depDelay >= 15 ? ` of about ${depDelay} min` : ""}${where ? ` at ${where}` : ""}. I'll keep watching — double-check the airline's live status too.`;
    case "scheduled":
      // Honest framing: report what the feed shows without over-promising, and
      // point to the airline as the source of truth.
      return `No delay reported yet${where ? ` — ${where}` : ""}. Live feeds can lag the airline, so confirm on the airline's page as departure nears — I'll flag any change I see.`;
    default:
      return "I couldn't confirm live status yet — check the airline's live status, and I'll keep watching.";
  }
}
