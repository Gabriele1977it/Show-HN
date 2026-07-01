// Transcript segmentation.
//
// Turns a raw transcript (with or without timestamps) into an ordered list of
// study segments. Each segment becomes one flashcard / shadowing loop.
//
// Three input shapes are recognised, in priority order:
//
// 1. Subtitle cues (SRT / WebVTT) — any block containing a `-->` range.
//    Both the start and end of each cue are captured, so shadowing loops use
//    the real cue boundaries rather than a guess.
//      1
//      00:00:01,000 --> 00:00:04,000   (SRT, comma milliseconds)
//      Hello there
//
//      00:04.000 --> 00:07.000         (WebVTT, dot milliseconds)
//      Second line
//
// 2. Leading timestamps on each line (end derived from the next line's start):
//      [00:12]   [01:02]   [00:12.5]   [1:02:33]   00:12 (bare)
//
// 3. Plain text — split into sentences and grouped so every card holds at most
//    `maxChars` characters.

const TS = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?`;
// Matches an optional leading timestamp token, bracketed or bare.
const LEADING_TS = new RegExp(`^\\s*(?:\\[\\s*(${TS})\\s*\\]|(${TS}))\\s*`);
// Matches a subtitle cue range like `00:00:01,000 --> 00:00:04,000`.
const CUE_RANGE = new RegExp(`(${TS})\\s*-->\\s*(${TS})`);

/** Convert a `mm:ss(.ms)` or `hh:mm:ss(.ms)` token into seconds. Accepts `,` ms. */
export function parseTimestamp(token) {
  if (token == null) return null;
  const parts = String(token).trim().replace(",", ".").split(":").map((p) => parseFloat(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + part;
  return seconds;
}

/**
 * Parse SRT / WebVTT cue blocks into segments with real start and end times.
 * Index lines, the `WEBVTT` header, `NOTE` blocks, and cue settings after the
 * timing line are ignored.
 * @returns {Array<{text: string, start: number|null, end: number|null}>}
 */
export function parseCues(text) {
  const blocks = (text ?? "").replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const segs = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const tIdx = lines.findIndex((l) => CUE_RANGE.test(l));
    if (tIdx === -1) continue; // header / note / stray block
    const m = CUE_RANGE.exec(lines[tIdx]);
    const body = lines.slice(tIdx + 1).join(" ").trim();
    if (!body) continue;
    segs.push({ text: body, start: parseTimestamp(m[1]), end: parseTimestamp(m[2]) });
  }
  return segs;
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

  // Subtitle files (SRT / WebVTT) take priority: a `-->` range gives us both
  // ends of every cue directly.
  if (CUE_RANGE.test(raw)) {
    const cues = parseCues(raw);
    if (cues.length) return cues;
  }

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
