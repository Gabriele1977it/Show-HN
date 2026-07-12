// Pure flight-number / status helpers with no imports, so they are safe to unit
// test under Node's native type-stripping and reusable anywhere.

export type FlightStatus =
  | "scheduled"
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

export function candidateFlightNumbers(fn: string): string[] {
  const match = fn.match(/^([A-Z]{2,3})(\d+[A-Z]?)$/);
  if (!match) return [fn];
  const [, prefix, num] = match;
  const iata = ICAO_TO_IATA[prefix];
  // Return both versions: the original and the IATA-converted one
  return iata && iata !== prefix ? [fn, iata + num] : [fn];
}

export function mapStatus(raw: string | undefined): FlightStatus {
  const valid = ["scheduled", "active", "landed", "cancelled", "incident", "diverted"];
  return valid.includes(raw ?? "") ? (raw as FlightStatus) : "unknown";
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
    case "scheduled": {
      if (depDelay != null && depDelay >= 15) {
        return `Running about ${depDelay} min behind${where ? ` from ${where}` : ""}. I'll keep watching and nudge you if it changes.`;
      }
      return `On schedule so far${where ? ` — ${where}` : ""}. I'll flag any change straight away.`;
    }
    default:
      return "I couldn't confirm live status yet — try again closer to departure, and I'll keep watching.";
  }
}
