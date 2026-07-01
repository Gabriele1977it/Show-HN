// Cloze (fill-in-the-blank) helpers.
//
// A cloze card hides one term inside the sentence so the learner recalls it
// actively. We store just the chosen term on the card; masking is derived.

const BLANK = "＿＿＿"; // full-width underscores read well next to CJK text

const KANJI = /[㐀-鿿豈-﫿]+/g;
const KANA = /[぀-ヿ]{2,}/g;

/**
 * Mask the first occurrence of `term` in `text`.
 * @returns {{masked:string, answer:string}|null} null when the term isn't present.
 */
export function applyCloze(text, term, blank = BLANK) {
  if (!text || !term) return null;
  const idx = text.indexOf(term);
  if (idx === -1) return null;
  return { masked: text.slice(0, idx) + blank + text.slice(idx + term.length), answer: term };
}

/** Pick the longest of a list, keeping the first on ties. */
function longest(items) {
  let best = null;
  for (const it of items) if (best == null || it.length > best.length) best = it;
  return best;
}

/**
 * Suggest a term to blank out of a sentence. Heuristic and deterministic:
 *  - space-delimited text  → the longest word (>= 3 chars when available)
 *  - CJK / unspaced text   → the longest kanji run, else longest kana run
 * @returns {string|null}
 */
export function suggestCloze(text) {
  const t = (text ?? "").trim();
  if (!t) return null;

  if (/\s/.test(t)) {
    const words = t
      .split(/\s+/)
      .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
      .filter(Boolean);
    if (!words.length) return null;
    const meaty = words.filter((w) => w.length >= 3);
    return longest(meaty.length ? meaty : words);
  }

  const kanji = t.match(KANJI);
  if (kanji) return longest(kanji);
  const kana = t.match(KANA);
  if (kana) return longest(kana);
  return null;
}
