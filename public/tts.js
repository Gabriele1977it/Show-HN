// Text-to-speech fallback.
//
// Cards without any audio source (pasted text, starter decks, plain-text
// imports) still deserve a listen-and-shadow loop. The browser's built-in
// speech synthesis provides one for free — client-side, offline-capable in
// the PWA, no API cost. The synth is injectable so voice picking and the
// speak plumbing are unit-testable in Node.

/** Prefer an exact BCP-47 match ("ja-JP"), then any voice of the language ("ja-…"). */
export function pickVoice(voices, lang) {
  if (!lang || !Array.isArray(voices)) return null;
  const want = String(lang).toLowerCase();
  const base = want.split("-")[0];
  return (
    voices.find((v) => String(v.lang || "").toLowerCase() === want) ||
    voices.find((v) => String(v.lang || "").toLowerCase().split("-")[0] === base) ||
    null
  );
}

export function createSpeaker({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance } = {}) {
  const available = Boolean(synth && Utterance);
  return {
    available,
    /** Speak `text` in `lang` at `rate` (clamped 0.5–2). Returns true if queued. */
    speak(text, { lang, rate = 1 } = {}) {
      const t = String(text ?? "").trim();
      if (!available || !t) return false;
      synth.cancel(); // one utterance at a time — a new card cuts off the old
      const u = new Utterance(t);
      if (lang) u.lang = lang;
      u.rate = Math.min(2, Math.max(0.5, Number(rate) || 1));
      const voice = pickVoice(synth.getVoices?.() ?? [], lang);
      if (voice) u.voice = voice;
      synth.speak(u);
      return true;
    },
    stop() {
      if (available) synth.cancel();
    },
  };
}
