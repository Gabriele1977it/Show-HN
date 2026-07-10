import { calcEU261, getAirportDistance, resolveAirport, type DisruptionKind } from "./eu261";
import { isDisruptionKind } from "./rights";

// Claim generation + lifecycle. The letter and the amount are computed
// deterministically (never invented), and escalation guidance points only to
// real regulators/ADR schemes — no fabricated airline addresses.

export const CLAIM_STATUSES = [
  "draft",
  "submitted",
  "airline_responded",
  "paid",
  "rejected",
  "escalated",
  "closed",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export function isClaimStatus(v: string): v is ClaimStatus {
  return (CLAIM_STATUSES as readonly string[]).includes(v);
}

// Allowed forward transitions; `closed` is reachable from anywhere and terminal.
const TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  draft: ["submitted", "closed"],
  submitted: ["airline_responded", "paid", "rejected", "closed"],
  airline_responded: ["paid", "rejected", "escalated", "closed"],
  paid: ["closed"],
  rejected: ["escalated", "closed"],
  escalated: ["paid", "rejected", "closed"],
  closed: [],
};

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export interface TimelineEntry {
  status: ClaimStatus;
  at: string; // ISO
  note?: string;
}

const TYPE_LABELS: Record<DisruptionKind, string> = {
  delay: "delay",
  cancellation: "cancellation",
  denied_boarding: "denied boarding",
  missed_connection: "missed connection",
};

export interface ClaimAmount {
  amount: number;
  currency: "EUR";
  distKm: number;
  tier: string;
}

/**
 * The headline compensation the traveller can claim for this route/disruption,
 * or null when the route isn't recognised or the type doesn't attract a fixed
 * amount (e.g. a plain missed connection).
 */
export function computeClaimAmount(
  origin: string,
  destination: string,
  disruptionType: string,
): ClaimAmount | null {
  const kind: DisruptionKind = isDisruptionKind(disruptionType) ? disruptionType : "delay";
  const distKm = getAirportDistance(origin, destination);
  if (distKm === null) return null;
  const r = calcEU261(distKm, kind, kind === "delay" ? 3 : undefined);
  if (!r.eligible) return null;
  return { amount: r.amount, currency: "EUR", distKm, tier: r.tier };
}

export interface ClaimLetterInput {
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledAt: string;
  disruptionType: string;
  amount: number | null;
  currency: string;
  claimantName?: string | null;
  claimantEmail?: string | null;
}

function cityLabel(code: string): string {
  const a = resolveAirport(code);
  return a ? `${a.city} (${code.toUpperCase()})` : code;
}

/**
 * Build a formal, ready-to-send EU261/UK261 compensation letter. Personal
 * fields we don't hold (postal address, booking reference, ID) are left as
 * clearly-marked placeholders for the traveller to complete.
 */
export function buildClaimLetter(input: ClaimLetterInput): string {
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const kind: DisruptionKind = isDisruptionKind(input.disruptionType) ? input.disruptionType : "delay";
  const typeLabel = TYPE_LABELS[kind];
  const route = `${cityLabel(input.origin)} to ${cityLabel(input.destination)}`;
  const amountStr = input.amount ? `${input.currency === "EUR" ? "€" : ""}${input.amount}` : "[amount per Regulation 261/2004]";
  const name = input.claimantName?.trim() || "[Your full name]";
  const email = input.claimantEmail?.trim() || "[Your email address]";

  return `${today}

${input.airline}
Customer Relations / EU261 Claims
[Airline claims address — see the airline's website]

Subject: Compensation claim under Regulation (EC) No 261/2004 (and UK-retained law)
Flight ${input.flightNumber} — ${route}

Dear Sir or Madam,

I am writing to claim compensation under Regulation (EC) No 261/2004, and its equivalent retained in United Kingdom law, in respect of the ${typeLabel} of flight ${input.flightNumber} operated by ${input.airline}.

FLIGHT DETAILS
  Flight number:        ${input.flightNumber}
  Route:                ${route}
  Scheduled departure:  ${input.scheduledAt}
  Nature of disruption: ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}

CLAIM
Based on the distance of this route and the nature of the disruption, I consider that I am entitled to compensation of ${amountStr}. Please treat this as a formal request for that sum. Where you contend that extraordinary circumstances apply, I ask you to state the specific circumstance and provide supporting evidence.

I request that you:
  1. Acknowledge this claim within 7 days.
  2. Provide a full written response within 14 days.
  3. Pay the compensation due to the bank details I will provide on acceptance.

I have retained my booking confirmation, boarding pass and related correspondence, and can supply them on request.

If I do not receive a satisfactory response within 8 weeks, I intend to escalate this matter to the competent regulator or an approved alternative dispute resolution (ADR) body, and I reserve the right to pursue the claim through the courts.

Yours faithfully,

${name}
${email}
[Your postal address]
[Your booking reference]
[Passport / ID — last 4 digits]`;
}

/**
 * Real, jurisdiction-appropriate escalation guidance. No fabricated contacts —
 * only the standing regulators and ADR routes.
 */
export function escalationGuidance(): string {
  return [
    "If the airline does not resolve your claim within 8 weeks, or gives a final response you disagree with, you can escalate — free of charge:",
    "• UK departures, or a UK/EU airline: the Civil Aviation Authority's Passenger Advice and Complaints Team (PACT), or an approved ADR body the airline belongs to (e.g. AviationADR or CEDR).",
    "• EU departures: the National Enforcement Body (NEB) of the country where the disruption happened — the European Commission publishes the full list.",
    "• You may also pursue the claim through the small-claims court.",
    "Keep proof of postage/sending and every piece of correspondence. This is guidance only, not legal advice.",
  ].join("\n");
}
