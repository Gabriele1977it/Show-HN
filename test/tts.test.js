import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVoice, createSpeaker } from "../public/tts.js";

const V = (lang, name) => ({ lang, name });

test("pickVoice prefers an exact tag match, then the base language", () => {
  const voices = [V("en-US", "Sam"), V("ja-JP", "Kyoko"), V("es-MX", "Paulina")];
  assert.equal(pickVoice(voices, "ja-JP").name, "Kyoko");
  assert.equal(pickVoice(voices, "es-ES").name, "Paulina"); // base-language fallback
  assert.equal(pickVoice(voices, "fr-FR"), null);
  assert.equal(pickVoice(voices, null), null);
  assert.equal(pickVoice(null, "en-US"), null);
});

function fakeSynth(voices = []) {
  const calls = { spoken: [], cancels: 0 };
  class Utterance { constructor(text) { this.text = text; } }
  const synth = {
    getVoices: () => voices,
    speak: (u) => calls.spoken.push(u),
    cancel: () => { calls.cancels += 1; },
  };
  return { synth, Utterance, calls };
}

test("speak builds an utterance with lang, clamped rate and a matching voice", () => {
  const { synth, Utterance, calls } = fakeSynth([V("ja-JP", "Kyoko")]);
  const s = createSpeaker({ synth, Utterance });
  assert.equal(s.available, true);
  assert.equal(s.speak("こんにちは", { lang: "ja-JP", rate: 0.1 }), true);
  const u = calls.spoken[0];
  assert.equal(u.text, "こんにちは");
  assert.equal(u.lang, "ja-JP");
  assert.equal(u.rate, 0.5); // clamped up from 0.1
  assert.equal(u.voice.name, "Kyoko");
  // Each speak cancels whatever was playing first.
  s.speak("second", {});
  assert.equal(calls.cancels, 2);
  assert.equal(calls.spoken.length, 2);
});

test("speak refuses empty text and reports unavailable without a synth", () => {
  const { synth, Utterance, calls } = fakeSynth();
  const s = createSpeaker({ synth, Utterance });
  assert.equal(s.speak("   "), false);
  assert.equal(calls.spoken.length, 0);
  const none = createSpeaker({ synth: undefined, Utterance: undefined });
  assert.equal(none.available, false);
  assert.equal(none.speak("hola"), false);
  none.stop(); // must not throw
});
