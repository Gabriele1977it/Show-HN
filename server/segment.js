// Transcript segmentation.
//
// Turns a raw transcript (with or without timestamps) into an ordered list of
// study segments. Each segment becomes one flashcard / shadowing loop.
//
// Supported timestamp prefixes at the start of a line:
//   [00:12]      -> 12s
//   [01:02]      -> 62s
//   [00:12.5]    -> 12.5s
//   [1:02:33]    -> 3753s
//   00:12        -> 12s   (bare, no brackets)
//   00:12 -->    -> 12s   (WebVTT / SRT style arrow, end time ignored if line has text after)
//
// When no timestamps are present the text is split into sentences and grouped
// so that every card holds at most `maxChars` characters of text.

const TS = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?`;
// Matches an optional leading timestamp token, bracketed or bare.
const LEADING_TS = new RegExp(`^\\s*(?:\\[\\s*(${TS})\\s*\\]|(${TS}))\\s*`);

/** Convert a `mm:ss(.ms)` or `hh:mm:ss(.ms)` token into seconds. */
export function parseTimestamp(token) {
  if (token == null) return null;
  const parts = String(token).trim().split(":").map((p) => parseFloat(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + part;
  return seconds;
}

function splitSentences(text) {
  // Split on Western and CJK sentence terminators, keeping the terminator.
  const out = [];
  const re = /[^.!?。！？…]+[.!?。！？…]+["'”’)\]]?|\S[^.!?。！？…]*$/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const s = m[0].trim();
    if (s) out.push(s);
  }
  return out.length ? out : (text.trim() ? [text.trim()] : []);
}

/**
 * Parse a transcript string into segments.
 * @param {string} transcript
 * @param {{maxChars?: number}} [opts]
 * @returns {Array<{text: string, start: number|null, end: number|null}>}
 */
export function segmentTranscript(transcript, opts = {}) {
  const maxChars = opts.maxChars ?? 180;
  const raw = (transcript ?? "").replace(/\r\n?/g, "\n");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  // Detect whether any line carries a leading timestamp.
  const timed = lines.some((l) => LEADING_TS.test(l));

  if (timed) {
    const segs = [];
    for (const line of lines) {
      const match = LEADING_TS.exec(line);
      if (!match) {
        // Continuation of the previous cue, append to it.
        if (segs.length) segs[segs.length - 1].text += " " + line;
        continue;
      }
      const start = parseTimestamp(match[1] ?? match[2]);
      const text = line.slice(match[0].length).replace(/^-->\s*/, "").trim();
      // Pure timing lines (SRT arrows like "00:01 --> 00:04") carry no text.
      if (!text) continue;
      segs.push({ text, start, end: null });
    }
    // Derive each segment's end from the next segment's start.
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].end == null && i + 1 < segs.length) {
        segs[i].end = segs[i + 1].start;
      }
    }
    return segs;
  }

  // No timestamps: split into sentences, then pack into <= maxChars chunks.
  const sentences = lines.flatMap(splitSentences);
  const segs = [];
  let buf = "";
  for (const sentence of sentences) {
    if (!buf) {
      buf = sentence;
    } else if ((buf + " " + sentence).length <= maxChars) {
      buf += " " + sentence;
    } else {
      segs.push({ text: buf, start: null, end: null });
      buf = sentence;
    }
  }
  if (buf) segs.push({ text: buf, start: null, end: null });
  return segs;
}
