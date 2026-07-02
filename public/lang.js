// Language name ↔ code helpers.
//
// The app stores human-readable language names on decks ("Japanese"), the Web
// Speech API wants BCP-47 tags ("ja-JP"), and caption/transcript APIs want ISO
// 639-1 codes ("ja"). This module converts between them and is unit-tested in
// Node (no DOM).

export const LANG_BCP47 = {
  japanese: "ja-JP", english: "en-US", spanish: "es-ES", french: "fr-FR", german: "de-DE",
  italian: "it-IT", portuguese: "pt-PT", korean: "ko-KR", mandarin: "zh-CN", chinese: "zh-CN",
  russian: "ru-RU", dutch: "nl-NL", polish: "pl-PL", turkish: "tr-TR", arabic: "ar-SA",
  hindi: "hi-IN", vietnamese: "vi-VN", thai: "th-TH", indonesian: "id-ID",
};

/** Speech-recognition tag for a language name ("Japanese" → "ja-JP"), or "". */
export const bcp47 = (lang) => LANG_BCP47[String(lang || "").trim().toLowerCase()] || "";

/**
 * ISO 639-1 code for a user-typed language ("English" → "en"; "en" / "en-US"
 * pass through as "en"). Returns undefined when unknown, so callers can omit
 * the parameter rather than send junk.
 */
export function isoOf(input) {
  const s = String(input ?? "").trim().toLowerCase();
  if (!s) return undefined;
  if (/^[a-z]{2}(-[a-z]{2,4})?$/.test(s)) return s.split("-")[0];
  const tag = LANG_BCP47[s];
  return tag ? tag.split("-")[0].toLowerCase() : undefined;
}

/** Readable name for a language code ("nl" → "Dutch"); unknown codes pass through. */
export function nameOf(code) {
  const c = String(code ?? "").trim().toLowerCase().split("-")[0];
  if (!c) return "";
  for (const [name, tag] of Object.entries(LANG_BCP47)) {
    if (tag.split("-")[0].toLowerCase() === c) return name[0].toUpperCase() + name.slice(1);
  }
  return code;
}
