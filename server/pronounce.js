// Pronunciation / shadowing scoring.
//
// The shadowing loop is only half the practice — the missing half is feedback.
// Given the card's target text and what the learner actually said (a transcript
// from the browser's Web Speech API, or a server-side STT webhook), this scores
// the attempt with word-level accuracy and suggests an SRS grade.
//
// Pure, dependency-free logic: the transcription is done elsewhere; here we only
// compare two strings. That keeps it fully testable and provider-agnostic.

// Han / Hiragana / Katakana / Hangul: these scripts don't use spaces, so we
// compare them character-by-character rather than word-by-word.
const CJK = /[぀-ヿ㐀-鿿가-힯豈-﫿ｦ-ﾟ]/;

/** Split text into comparable tokens: latin/number words, or single CJK chars. */
export function tokenize(text) {
  const out = [];
  for (const m of String(text ?? "").toLowerCase().normalize("NFKC").matchAll(/[\p{L}\p{N}]+/gu)) {
    const run = m[0];
    if ([...run].some((ch) => CJK.test(ch))) {
      for (const ch of run) out.push(ch);
    } else {
      out.push(run);
    }
  }
  return out;
}

// Longest common subsequence between two token arrays. Returns, for each target
// index, whether that token was matched (in order) by the heard tokens.
function matchTargets(target, heard) {
  const n = target.length, m = heard.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = target[i] === heard[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matched = new Array(n).fill(false);
  const heardUsed = new Array(m).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (target[i] === heard[j]) { matched[i] = true; heardUsed[j] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return { matched, heardUsed };
}

const gradeFor = (score) => (score >= 90 ? "easy" : score >= 75 ? "good" : score >= 50 ? "hard" : "again");

/**
 * Score a shadowing attempt.
 * @param {string} target - the card's text (what should have been said)
 * @param {string} heard  - the recognized transcript of the attempt
 * @returns {{score:number, matched:number, total:number, words:Array, missed:string[], extra:string[], suggestedGrade:string, empty:boolean}}
 */
export function scoreAttempt(target, heard) {
  const t = tokenize(target);
  const h = tokenize(heard);
  if (t.length === 0) {
    return { score: 0, matched: 0, total: 0, words: [], missed: [], extra: h, suggestedGrade: "again", empty: true };
  }
  const { matched, heardUsed } = matchTargets(t, h);
  const hits = matched.filter(Boolean).length;
  const score = Math.round((hits / t.length) * 100);
  return {
    score,
    matched: hits,
    total: t.length,
    words: t.map((tok, idx) => ({ token: tok, ok: matched[idx] })),
    missed: t.filter((_, idx) => !matched[idx]),
    extra: h.filter((_, idx) => !heardUsed[idx]),
    suggestedGrade: gradeFor(score),
    empty: h.length === 0,
  };
}
