import { generateJson } from "./llm";
import { logger } from "./logger";
import {
  buildDeterministicAnalysis,
  type ActionItem,
  type ChecklistItem,
  type DisruptionInput,
  type ProactiveAction,
} from "./rights";

// The AI here is deliberately *tone-only*. The legal content — rights, actions,
// and checklist — is computed deterministically in `rights.ts` and is never
// generated or altered by the model. The model only rewrites the companion
// message and the single proactive action into warmer, situation-specific
// language, and may add a gentle "HOLTO Living" hint. If the model is
// unavailable (bad airport wifi, no key, timeout), the deterministic copy is
// used unchanged — so a stranded traveller always gets full, honest guidance.

export type { DisruptionInput, ActionItem, ChecklistItem, ProactiveAction } from "./rights";

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

interface ToneResult {
  companionMessage: string;
  proactiveHint: string | null;
  proactiveAction: ProactiveAction;
}

// Ask the model ONLY to rephrase — it is given the already-decided facts and
// must not change any rights, amounts, or the action itself.
async function generateTone(
  input: DisruptionInput,
  base: { companionMessage: string; proactiveAction: ProactiveAction; rights: string },
): Promise<ToneResult | null> {
  const typeLabel = TYPE_LABEL[input.disruptionType] ?? input.disruptionType;

  const prompt = `You are HOLTO, a calm, trustworthy travel-disruption companion — like a knowledgeable friend.
A traveller has a ${typeLabel} on ${input.airline} ${input.flightNumber} (${input.origin} → ${input.destination}).
Their note: "${input.details}"

Below is the ALREADY-DECIDED guidance. Your ONLY job is to rephrase the companion message and the proactive action so they sound warm, personal, and specific to this traveller. You MUST NOT change any facts, rights, amounts, thresholds, or the substance of the action. Do not invent entitlements.

CURRENT companion message: "${base.companionMessage}"
CURRENT proactive action: ${JSON.stringify(base.proactiveAction)}

Respond ONLY with valid JSON, no markdown:
{
  "companionMessage": "1-2 warm sentences, personal to their flight. No hype.",
  "proactiveAction": { "title": "5-8 words", "description": "2-3 sentences, direct 'you' voice, SAME substance as current", "urgency": "${base.proactiveAction.urgency}", "why": "one honest sentence" },
  "proactiveHint": null
}
Set proactiveHint to a single gentle sentence about HOLTO Living ONLY if this is a cancellation or a very long delay leaving them stranded for hours, and it feels genuinely helpful; otherwise null. Never be pushy.`;

  try {
    // Free-first (Gemini) tone rewrite. Fail fast on poor airport wifi — the
    // deterministic copy is the fallback, so there's no reason to wait long.
    const parsed = (await generateJson(prompt, { maxTokens: 500, temperature: 0.4, timeoutMs: 8000 })) as Partial<ToneResult> | null;
    if (!parsed || !parsed.companionMessage || !parsed.proactiveAction?.title || !parsed.proactiveAction?.description) {
      return null;
    }
    return {
      companionMessage: parsed.companionMessage,
      proactiveHint: parsed.proactiveHint ?? null,
      proactiveAction: {
        title: parsed.proactiveAction.title,
        description: parsed.proactiveAction.description,
        urgency: base.proactiveAction.urgency, // keep the computed urgency, not the model's
        why: parsed.proactiveAction.why ?? base.proactiveAction.why,
      },
    };
  } catch (e) {
    logger.warn({ err: e }, "AI tone generation failed — using deterministic copy");
    return null;
  }
}

/**
 * Produce the full companion analysis for a disruption. Rights, actions, and
 * checklist are always the deterministic, honest computation; the AI only warms
 * the companion message and proactive action, and is skipped entirely on any
 * failure. This function never throws.
 */
export async function analyzeDisruption(input: DisruptionInput): Promise<CompanionAnalysis> {
  const base = buildDeterministicAnalysis(input);

  const tone = await generateTone(input, {
    companionMessage: base.companionMessage,
    proactiveAction: base.proactiveAction,
    rights: base.rights,
  });

  return {
    rights: base.rights,
    actions: base.actions,
    checklist: base.checklist,
    companionMessage: tone?.companionMessage ?? base.companionMessage,
    proactiveHint: tone?.proactiveHint ?? null,
    proactiveAction: tone?.proactiveAction ?? base.proactiveAction,
  };
}
