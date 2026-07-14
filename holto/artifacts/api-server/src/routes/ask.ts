import { Router, type IRouter } from "express";

import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getUserTier } from "../lib/tier";
import { generateText } from "../lib/llm";
import { allowAiCall } from "../lib/usage";
import { buildUserContext } from "../lib/ask-context";

const router: IRouter = Router();

// Response shape for the new Places API (places:searchNearby).
interface NewPlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  location?: { latitude?: number; longitude?: number };
  currentOpeningHours?: { openNow?: boolean };
}

const PLACE_KEYWORDS: { keywords: string[]; type: string; keyword?: string }[] = [
  { keywords: ["eat", "food", "hungry", "restaurant", "meal", "lunch", "dinner", "breakfast", "snack", "bite"], type: "restaurant" },
  { keywords: ["coffee", "cafe", "cafeteria", "espresso", "cappuccino"], type: "cafe" },
  { keywords: ["pharmacy", "medicine", "drug", "chemist", "tablet", "painkiller", "aspirin", "headache"], type: "pharmacy" },
  { keywords: ["atm", "cash", "money", "withdraw", "currency", "exchange"], type: "atm" },
  { keywords: ["hotel", "sleep", "rest", "stay", "accommodation", "overnight", "bed", "nap"], type: "lodging" },
  { keywords: ["taxi", "cab", "transport", "car", "ride", "uber", "lyft"], type: "taxi_stand" },
  { keywords: ["shop", "store", "buy", "purchase", "souvenir", "gift"], type: "shopping_mall" },
  { keywords: ["charge", "charging", "battery", "power", "outlet", "plug", "usb", "electricity"], type: "electronics_store" },
  { keywords: ["bar", "alcohol", "wine", "beer", "pub", "drink", "cocktail"], type: "bar" },
  { keywords: ["lounge", "vip", "premium", "business", "first class"], type: "airport", keyword: "lounge" },
  { keywords: ["toilet", "bathroom", "restroom", "wc", "loo"], type: "subway_station", keyword: "toilet" },
  { keywords: ["wifi", "internet", "connect", "hotspot"], type: "cafe" },
  { keywords: ["bank", "banking", "financial"], type: "bank" },
  { keywords: ["hospital", "doctor", "medical", "clinic", "injury", "sick", "ill"], type: "hospital" },
];

function detectPlaceType(question: string): { type: string; keyword?: string } | null {
  const lower = question.toLowerCase();
  for (const entry of PLACE_KEYWORDS) {
    if (entry.keywords.some((k) => lower.includes(k))) {
      return { type: entry.type, keyword: entry.keyword };
    }
  }
  return null;
}

router.post("/ask", requireAuth, async (req, res): Promise<void> => {
  const tier = await getUserTier(req.auth!.userId);
  if (tier === "free") {
    res.status(403).json({ error: "Ask HOLTO requires a Trip Pass or Holto Pro subscription.", requiresUpgrade: true });
    return;
  }

  const { question, lat, lng } = req.body as { question?: string; lat?: number; lng?: number };

  if (!question?.trim()) {
    res.status(400).json({ error: "Please enter a question." });
    return;
  }

  // Accept either env name — the Places lookup uses a standard Google Cloud key,
  // which many deployments store as GOOGLE_MAPS_API_KEY.
  const googleApiKey = process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  let places: Array<{ name: string; vicinity: string; rating: number | null; openNow: boolean | null; placeId: string | null; lat: number | null; lng: number | null }> = [];

  const placeDetection = detectPlaceType(question);

  if (lat != null && lng != null && googleApiKey && placeDetection) {
    try {
      const { type } = placeDetection;
      const placesRes = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": googleApiKey,
          // Only request the fields we render — smaller, cheaper responses.
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.location,places.currentOpeningHours.openNow",
        },
        body: JSON.stringify({
          includedTypes: [type],
          maxResultCount: 5,
          rankPreference: "DISTANCE",
          locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 2000 } },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!placesRes.ok) {
        // Surface the exact reason (REQUEST_DENIED, key restriction, API not
        // enabled, …) so a misconfiguration is diagnosable from the logs.
        const errText = await placesRes.text().catch(() => "");
        logger.warn({ status: placesRes.status, body: errText.slice(0, 400) }, "Google Places (new) returned non-OK");
      } else {
        const placesData = (await placesRes.json()) as { places?: NewPlace[] };
        places = (placesData.places ?? []).slice(0, 4).map((p) => ({
          name: p.displayName?.text ?? "Unnamed place",
          vicinity: p.formattedAddress ?? "",
          rating: p.rating ?? null,
          openNow: p.currentOpeningHours?.openNow ?? null,
          placeId: null,
          lat: p.location?.latitude ?? null,
          lng: p.location?.longitude ?? null,
        }));
      }
    } catch (e) {
      logger.warn({ err: e }, "Google Places lookup failed");
    }
  }

  const locationNote =
    lat != null && lng != null
      ? `The traveller's current coordinates are ${lat.toFixed(4)}, ${lng.toFixed(4)}.`
      : "No location data provided.";

  const placesContext =
    places.length > 0
      ? `Nearby places found:\n${places
          .map(
            (p, i) =>
              `${i + 1}. ${p.name} — ${p.vicinity}${p.rating != null ? `, rated ${p.rating}/5` : ""}${p.openNow === true ? " (open now)" : p.openNow === false ? " (currently closed)" : ""}`,
          )
          .join("\n")}`
      : "";

  // What HOLTO knows about this traveller (their trips, flights, residency days)
  // so it can answer personal questions accurately. Capped to keep input tokens
  // (and therefore cost) bounded per question.
  const userContext = (await buildUserContext(req.auth!.userId)).slice(0, 900);

  const prompt = `You are HOLTO, a warm, knowledgeable travel companion for British travellers, anywhere in the world. You answer practical on-the-ground questions ("Where can I eat?"), general travel-planning questions ("Best months to visit Lisbon", "What should I pack?"), and personal questions about the traveller's own plans.

${locationNote}

${userContext ? `What you know about this traveller (use these facts for personal questions about their flights, trips or days in a country — quote the specific numbers/dates):\n${userContext}\n\n` : ""}Their question: "${question.trim()}"

${placesContext ? placesContext + "\n\n" : ""}Give a short, natural, helpful answer (3-5 sentences max). ${
    places.length > 0
      ? "Recommend the most helpful nearby option by name with practical context. Refer to the area using the place addresses above — never try to name their city or region from raw coordinates."
      : placeDetection
        ? "You have NO live results for places near them right now. Tell them plainly you can't see nearby options at this moment — their location sharing may be off, or none are listed — and suggest turning on location or naming the area they're in. Do NOT present hotels, restaurants or places from their saved trips as if they are nearby, and do NOT invent nearby places."
        : "Give clear, accurate travel advice. Don't guess the traveller's city or region from coordinates; only reference a location if it's stated in the facts above."
  } If they ask about their own flights, trips or days in a country, answer from the facts above; if a fact isn't listed, say you don't have it rather than guessing. Write complete sentences and finish your final thought. Never include notes about your own reasoning or planning — reply only with the answer. Be warm and direct like a knowledgeable friend — never robotic, never vague.`;

  const gate = await allowAiCall(req.auth!.userId);
  if (!gate.allowed) {
    res.status(429).json({ error: "You've reached today's AI limit. It resets tomorrow — upgrade for unlimited questions.", requiresUpgrade: true });
    return;
  }

  // Generous output budget: the prompt already caps the answer to 3–5
  // sentences, but a 2.5 model can spend part of the budget before the visible
  // reply, so a tight cap truncated answers mid-sentence. Real cost is driven by
  // tokens actually generated, not the ceiling.
  const answer =
    (await generateText(prompt, { maxTokens: 800, temperature: 0.4 })) ??
    "I couldn't get a response right now — try again in a moment.";
  if (answer.startsWith("I couldn't get")) {
    logger.warn("ask: LLM returned no answer");
  }

  res.json({ answer, places });
});

export default router;
