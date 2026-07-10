import { calcEU261, getAirportDistance, type DisruptionKind, type EU261Result } from "./eu261";

// Deterministic passenger-rights builder. This produces the *legal* content —
// rights explanation, next actions, and checklist — from the facts alone, with
// no LLM involvement, so HOLTO never invents rights or amounts. The AI layer in
// `ai.ts` only adds warm phrasing on top (and falls back to these when offline).

export interface DisruptionInput {
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledAt: string;
  disruptionType: string;
  details: string;
}

export interface ActionItem {
  order: number;
  title: string;
  description: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  category?: "documentation" | "contact" | "claim" | "practical";
}

export interface ProactiveAction {
  title: string;
  description: string;
  urgency: "high" | "medium" | "low";
  why: string;
}

export interface DeterministicAnalysis {
  rights: string;
  actions: ActionItem[];
  checklist: ChecklistItem[];
  companionMessage: string;
  proactiveAction: ProactiveAction;
  /** Computed compensation, when the route distance is known. */
  eu261: EU261Result | null;
}

const DISCLAIMER = "This is guidance only, not legal advice.";

const APPLICABILITY =
  "UK261 covers flights departing a UK airport, or arriving in the UK on a UK/EU airline. " +
  "EU261 covers flights departing an EU airport, or arriving in the EU on an EU/UK airline. " +
  "If neither applies to your flight, these specific amounts may not — check your airline's and the local regulator's rules.";

function compensationLine(eu261: EU261Result | null): string {
  if (!eu261) {
    return "The exact amount depends on your flight distance (typically €250 short-haul, €400 medium-haul, €600 long-haul).";
  }
  if (eu261.eligible) {
    return `For your route (~${eu261.distKm.toLocaleString()} km, ${eu261.tier}), the headline amount is €${eu261.amount}. ${eu261.note}`;
  }
  return eu261.reason ?? "";
}

function extraordinaryNote(): string {
  return (
    "Compensation is not due if the disruption was caused by extraordinary circumstances outside the airline's " +
    "control (e.g. severe weather, air-traffic-control restrictions or strikes, security risks). Airlines lean on " +
    "this to reject claims, so ask them to state the reason in writing."
  );
}

interface Template {
  rights: (eu261: EU261Result | null) => string;
  actions: ActionItem[];
  checklist: string[]; // "category|text"
  companionMessage: string;
  proactiveAction: ProactiveAction;
}

const TEMPLATES: Record<DisruptionKind, Template> = {
  delay: {
    rights: (eu261) =>
      [
        "If your flight is delayed and you reach your final destination 3 or more hours late, you may be entitled to cash compensation. " +
          compensationLine(eu261),
        "Separately, once the delay passes a threshold (2h short-haul, 3h medium-haul, 4h long-haul) the airline owes you 'duty of care' — " +
          "free meals and refreshments, and hotel accommodation plus transfers if you're delayed overnight. This is owed regardless of the cause. " +
          "If the delay reaches 5 hours you can choose not to travel and get a full refund instead.",
        extraordinaryNote(),
        APPLICABILITY,
        DISCLAIMER,
      ].join("\n\n"),
    actions: [
      { order: 1, title: "Ask for the delay reason in writing", description: "Get the airline to confirm the length and cause of the delay at the desk or by email — you'll need it for any claim." },
      { order: 2, title: "Claim your duty of care now", description: "If you're past the care threshold, ask staff for meal/refreshment vouchers, and hotel + transfers if you'll be delayed overnight." },
      { order: 3, title: "Keep every receipt", description: "If the airline won't provide care, buy reasonable food/accommodation yourself and keep the receipts to claim back later." },
      { order: 4, title: "Note your actual arrival time", description: "Compensation depends on how late you arrive at your final destination — record it precisely." },
      { order: 5, title: "Submit a claim to the airline", description: "After the trip, claim compensation directly from the airline first, citing UK261/EU261 and your route distance." },
    ],
    checklist: [
      "documentation|Photograph the departure board showing the delay",
      "documentation|Get written confirmation of the delay length and reason",
      "documentation|Note your scheduled vs actual arrival time",
      "contact|Ask airline staff for meal/refreshment vouchers",
      "contact|Ask about hotel + transfers if delayed overnight",
      "claim|Keep all receipts for food and accommodation",
      "claim|Submit a UK261/EU261 claim to the airline after the trip",
    ],
    companionMessage:
      "I'm sorry your flight is delayed — that's stressful. Let's make sure you get the care you're owed right now, and protect any compensation claim.",
    proactiveAction: {
      title: "Ask for care and a written reason",
      description:
        "Go to the airline desk and ask for meal vouchers (and a hotel if overnight), plus written confirmation of the delay's length and cause. Do this before queues build.",
      urgency: "high",
      why: "Duty of care is owed regardless of the cause, and the written reason is what decides any compensation claim.",
    },
  },
  cancellation: {
    rights: (eu261) =>
      [
        "When a flight is cancelled you have the right to choose between a full refund (of the unused parts of your ticket) or re-routing to your " +
          "destination at the earliest opportunity. You're also owed duty of care — meals, refreshments, and accommodation if you're kept overnight — while you wait.",
        "If the airline told you less than 14 days before departure, you may also be entitled to cash compensation. " +
          compensationLine(eu261),
        extraordinaryNote(),
        APPLICABILITY,
        DISCLAIMER,
      ].join("\n\n"),
    actions: [
      { order: 1, title: "Choose refund or re-routing — in writing", description: "Tell the airline which you want and get their response in writing. Re-routing keeps a compensation claim alive; a refund usually ends the journey." },
      { order: 2, title: "Get to the airline desk now", description: "Rebooking seats go fast. Go to the desk or transfer counter immediately, and call the airline in parallel." },
      { order: 3, title: "Ask when you were notified", description: "Get written confirmation of the cancellation date/time — the 14-day rule decides compensation." },
      { order: 4, title: "Claim duty of care", description: "Ask for meals and, if needed, a hotel and transfers while you wait for the alternative." },
      { order: 5, title: "Submit a compensation claim", description: "If notified inside 14 days and not an extraordinary circumstance, claim compensation from the airline citing UK261/EU261." },
    ],
    checklist: [
      "documentation|Screenshot the cancellation notification with its date/time",
      "documentation|Note how many days before departure you were told",
      "contact|Tell the airline whether you want a refund or re-routing (in writing)",
      "contact|Ask for meals and accommodation while you wait",
      "claim|Keep receipts for any care you pay for yourself",
      "claim|Submit a UK261/EU261 compensation claim to the airline",
      "practical|Keep your original boarding pass and booking reference",
    ],
    companionMessage:
      "A cancellation is frustrating, but you have clear rights here — a choice of refund or re-routing, care while you wait, and possibly compensation. Let's sort it calmly.",
    proactiveAction: {
      title: "Get to the desk and choose in writing",
      description:
        "Go to the airline desk now and state whether you want a full refund or re-routing — and get it in writing. Then ask for meals and a hotel if you'll be waiting long.",
      urgency: "high",
      why: "Alternative flights fill up fast, and your written choice protects both your journey and any compensation claim.",
    },
  },
  denied_boarding: {
    rights: (eu261) =>
      [
        "If you were denied boarding against your will — usually because the flight was overbooked — and you had a confirmed reservation and checked in on time, " +
          "this is one of the clearest entitlements: cash compensation is almost always owed. " +
          compensationLine(eu261),
        "You must also be offered a choice of re-routing or a full refund, plus duty of care (meals and accommodation) in the meantime. " +
          "If you volunteered to give up your seat, different, negotiated terms apply instead.",
        APPLICABILITY,
        DISCLAIMER,
      ].join("\n\n"),
    actions: [
      { order: 1, title: "Get the denial confirmed in writing", description: "Do not leave the gate without written confirmation that you were denied boarding, plus the EU261/UK261 claim form." },
      { order: 2, title: "Confirm you didn't volunteer", description: "Make clear you were denied involuntarily — volunteering waives the fixed compensation in exchange for negotiated perks." },
      { order: 3, title: "Choose re-routing or a refund", description: "Ask the airline for your choice of the next available flight or a full refund, and get it in writing." },
      { order: 4, title: "Claim your care", description: "Ask for meals and, if needed, accommodation and transfers while you wait." },
      { order: 5, title: "Submit the compensation claim", description: "File the claim with the airline citing denied boarding under UK261/EU261 — this entitlement is rarely deniable." },
    ],
    checklist: [
      "documentation|Get written confirmation of the denied boarding",
      "documentation|Request the EU261/UK261 compensation claim form",
      "documentation|Record whether you were denied involuntarily",
      "contact|Ask for re-routing or a full refund (your choice)",
      "contact|Ask for meals and accommodation while you wait",
      "claim|Submit the denied-boarding compensation claim to the airline",
    ],
    companionMessage:
      "Being denied boarding is upsetting — but this is the strongest case of all: if you didn't volunteer, you're almost certainly owed compensation. Let's get the paperwork before you leave the gate.",
    proactiveAction: {
      title: "Get written proof before leaving the gate",
      description:
        "Ask the gate staff, right now, for written confirmation of the denied boarding and the EU261/UK261 claim form. Make clear you did not volunteer your seat.",
      urgency: "high",
      why: "Denied-boarding compensation is almost always owed, but the written proof from the gate is what makes the claim stick.",
    },
  },
  missed_connection: {
    rights: () =>
      [
        "Whether you're covered depends on how your flights were booked. If your connection was on a single booking (one ticket / reservation), " +
          "the airline is responsible: they must re-route you to your final destination at no cost, and compensation may apply based on how late you " +
          "arrive there. If your flights were on separate tickets, the airlines are generally not responsible for the missed connection, and you may " +
          "need to book the next flight yourself.",
        "Either way, if you're kept waiting a long time you may be entitled to duty of care (meals, and accommodation if overnight) from the airline operating the delayed leg.",
        extraordinaryNote(),
        APPLICABILITY,
        DISCLAIMER,
      ].join("\n\n"),
    actions: [
      { order: 1, title: "Go to the transfer desk immediately", description: "Every minute matters — head straight to the airline's transfer or connections desk to be rebooked." },
      { order: 2, title: "Check if it was one ticket or two", description: "Find your booking reference(s): a single PNR means the airline must re-route you free; separate tickets usually mean you're on your own." },
      { order: 3, title: "Ask for re-routing at no cost", description: "If it was a single booking, insist on being re-routed to your final destination at no extra charge." },
      { order: 4, title: "Record your final-destination delay", description: "Note how late you ultimately arrive — compensation (if due) is based on that, not the missed leg itself." },
      { order: 5, title: "Keep receipts and claim", description: "Keep receipts for any care you buy, and claim compensation/care from the airline operating the delayed leg." },
    ],
    checklist: [
      "documentation|Find your booking reference(s) — one ticket or separate tickets?",
      "documentation|Note the delay that caused you to miss the connection",
      "contact|Go to the transfer desk and ask to be re-routed",
      "contact|Ask for meals/accommodation if you'll be waiting long",
      "claim|Record how late you arrive at your final destination",
      "claim|Keep receipts and submit a claim to the operating airline",
    ],
    companionMessage:
      "Missing a connection is stressful, but let's move fast: get to the transfer desk now. Whether you're owed a free re-route depends on how your tickets were booked — we'll check that together.",
    proactiveAction: {
      title: "Get to the transfer desk now",
      description:
        "Head straight to the airline's transfer/connections desk to be rebooked — don't wait in the main queue. Have your booking reference ready to show whether it was a single ticket.",
      urgency: "high",
      why: "On a single booking the airline must re-route you at no cost, and seats on the next flight go quickly.",
    },
  },
};

const KIND_SET: ReadonlySet<string> = new Set<DisruptionKind>([
  "delay",
  "cancellation",
  "denied_boarding",
  "missed_connection",
]);

export function isDisruptionKind(value: string): value is DisruptionKind {
  return KIND_SET.has(value);
}

/**
 * Build the full deterministic analysis for a disruption — rights text, ordered
 * actions, and a categorised checklist — plus deterministic companion copy that
 * the AI layer may later replace with warmer phrasing. Never touches the network.
 */
export function buildDeterministicAnalysis(input: DisruptionInput): DeterministicAnalysis {
  const kind: DisruptionKind = isDisruptionKind(input.disruptionType) ? input.disruptionType : "delay";
  const template = TEMPLATES[kind];

  const distKm = getAirportDistance(input.origin, input.destination);
  // For a delay we frame the amount on the 3h+ condition; other types don't take hours.
  const eu261 = distKm !== null ? calcEU261(distKm, kind, kind === "delay" ? 3 : undefined) : null;

  const checklist: ChecklistItem[] = template.checklist.map((entry, i) => {
    const [category, text] = entry.split("|");
    return { id: `item_${i + 1}`, text, done: false, category: category as ChecklistItem["category"] };
  });

  return {
    rights: template.rights(eu261),
    actions: template.actions,
    checklist,
    companionMessage: template.companionMessage,
    proactiveAction: template.proactiveAction,
    eu261,
  };
}
