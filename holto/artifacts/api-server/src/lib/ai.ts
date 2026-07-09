import OpenAI from "openai";

import { logger } from "./logger";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "no-key",
});

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
  category?: string;
}

export interface ProactiveAction {
  title: string;
  description: string;
  urgency: "high" | "medium" | "low";
  why: string;
}

export interface CompanionAnalysis {
  rights: string;
  actions: ActionItem[];
  checklist: ChecklistItem[];
  companionMessage: string;
  proactiveHint: string | null;
  proactiveAction: ProactiveAction;
}

const TYPE_LABEL: Record<string, string> = {
  delay: "delayed flight",
  cancellation: "cancelled flight",
  missed_connection: "missed connecting flight",
  denied_boarding: "denied boarding",
};

const TYPE_PROACTIVE_GUIDANCE: Record<string, string> = {
  delay: `The single most important proactive action for a delayed flight is typically:
  - If delay < 2 hours: Not much to do yet — monitor and document.
  - If delay 2-3 hours: Ask airline staff for meal/drink vouchers (EU261 duty of care kicks in at 2hrs for short flights).
  - If delay 3+ hours: The passenger may be entitled to cash compensation — instruct them to ask the airline for a delay confirmation letter and EU261 form.
  - If delay 5+ hours: Passenger can choose to NOT travel and get a full refund instead.
  Focus on what's actionable RIGHT NOW based on the details provided.`,
  cancellation: `The single most important proactive action for a cancelled flight is:
  - The passenger has a right to choose: full refund OR rebooking on next available flight.
  - They should ask the airline for this IN WRITING at the desk or counter.
  - If the cancellation was less than 14 days' notice and not due to extraordinary circumstances, EU/UK 261 compensation may apply.
  - Instruct them to get to the airline desk NOW before queues build.`,
  missed_connection: `The single most important proactive action for a missed connection is:
  - If the connection was on ONE booking (same ticket/PNR): the airline is responsible and must rebook at no cost.
  - If the connections were on SEPARATE tickets: the passenger is on their own — instruct them to book next available flight.
  - They should go to the airline desk or transfer desk IMMEDIATELY — every minute matters.`,
  denied_boarding: `The single most important proactive action for denied boarding is:
  - This is likely the clearest EU/UK 261 entitlement — compensation is almost always owed (unless passenger volunteered).
  - The FIRST thing to do: demand the airline provide written confirmation of the denial AND the EU261 compensation claim form.
  - Do NOT leave the gate without this paperwork.
  - Compensation is typically €250-€600 depending on route distance.`,
};

export async function analyzeDisruption(input: DisruptionInput): Promise<CompanionAnalysis> {
  const typeLabel = TYPE_LABEL[input.disruptionType] ?? input.disruptionType;
  const proactiveGuidance = TYPE_PROACTIVE_GUIDANCE[input.disruptionType] ?? "";

  const prompt = `You are HOLTO, a calm, trustworthy travel disruption companion — like a knowledgeable friend who happens to know passenger rights law.

A traveller has just reported a flight problem and needs your help RIGHT NOW. They are likely stressed. Be calm, honest, and clear.

FLIGHT DETAILS:
- Airline: ${input.airline}
- Flight: ${input.flightNumber}  
- Route: ${input.origin} → ${input.destination}
- Scheduled: ${input.scheduledAt}
- Problem type: ${typeLabel}
- Passenger's description: "${input.details}"

TYPE-SPECIFIC GUIDANCE FOR proactiveAction:
${proactiveGuidance}

Respond ONLY with valid JSON in this exact shape:

{
  "companionMessage": "One calm, warm, personal sentence. Acknowledge their specific situation (use their flight/route). Reassure them. Sound like a trusted friend, NOT a chatbot. No marketing. Max 2 sentences.",
  
  "proactiveAction": {
    "title": "Concise action title (5-8 words max)",
    "description": "2-3 sentences of specific, actionable instruction for RIGHT NOW. Use 'you' — talk directly to them. Be specific to their situation.",
    "urgency": "high|medium|low",
    "why": "One honest sentence explaining why this is the most important action — cite the regulation or practical reason."
  },
  
  "rights": "2-3 clear paragraphs. Explain their likely rights under UK261/EU261 honestly. State clearly when rights DO and DON'T apply. Mention key thresholds. Note when entitlement is uncertain — never invent certainty. Use plain English. End with 'This is guidance only, not legal advice.'",
  
  "actions": [
    {"order": 1, "title": "Short action title", "description": "Specific instruction."},
    {"order": 2, ...},
    ...
  ],
  
  "checklist": [
    {"id": "item_1", "text": "Specific task", "done": false, "category": "documentation|contact|claim|practical"},
    ...
  ],
  
  "proactiveHint": null
}

RULES:
- companionMessage: personal, warm, specific to their flight — NOT generic
- proactiveAction: THE single most urgent thing to do right now — type-specific, honest
- rights: honest about uncertainty; mention EU departure/EU carrier requirement for EU261; UK261 for UK flights
- actions: 4-6 items, ordered by urgency, practical and specific
- checklist: 5-8 items covering documentation + airline contact + rights claim
- proactiveHint: ONLY include a gentle, natural mention of HOLTO Living if: (a) this is a cancellation or 5+ hour delay leaving them stranded for many hours, AND (b) it feels genuinely helpful in context. Example: "While you wait, some travellers use time like this to think about longer stays — HOLTO Living has honest guides for that." If not naturally relevant, return null. NEVER be pushy. Never mention it twice.
- Respond ONLY with valid JSON, no markdown, no code fences`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  try {
    return JSON.parse(content) as CompanionAnalysis;
  } catch (e) {
    logger.error({ err: e, content }, "Failed to parse AI response");
    throw new Error("Failed to parse AI response");
  }
}
