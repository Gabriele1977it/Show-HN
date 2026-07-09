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
