import zlib from "node:zlib";

// Best-effort, dependency-free extraction of visible text from a PDF's content
// streams. Handles the common case — FlateDecode text content — and deliberately
// skips image streams. This is NOT a full PDF parser: it returns "" when it
// can't help, so callers can fall back to other paths (e.g. asking the user to
// paste). Used only as a fallback when the vision model can't read a PDF.

function inflate(buf: Buffer): Buffer | null {
  try {
    return zlib.inflateSync(buf);
  } catch {
    /* not zlib-wrapped */
  }
  try {
    return zlib.inflateRawSync(buf);
  } catch {
    /* not raw deflate either */
  }
  return null;
}

// Decode PDF string escapes inside a literal ( ... ).
function decodeLiteral(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = s[i + 1];
    if (n === undefined) break;
    if (n === "n") out += "\n";
    else if (n === "r") out += "\r";
    else if (n === "t") out += "\t";
    else if (n === "b") out += "\b";
    else if (n === "f") out += "\f";
    else if (n === "(" || n === ")" || n === "\\") out += n;
    else if (n >= "0" && n <= "7") {
      let oct = n;
      i++;
      for (let k = 0; k < 2 && i + 1 < s.length && s[i + 1]! >= "0" && s[i + 1]! <= "7"; k++) {
        oct += s[i + 1];
        i++;
      }
      out += String.fromCharCode(parseInt(oct, 8) & 0xff);
      continue;
    } else out += n;
    i++;
  }
  return out;
}

// Pull the text-showing string operands out of a content stream. Only runs on
// streams that actually look like text content (contain BT and Tj/TJ), which
// naturally excludes image data.
function extractText(content: string): string {
  if (!content.includes("BT") || !(content.includes("Tj") || content.includes("TJ"))) return "";

  const out: string[] = [];
  const n = content.length;
  let i = 0;
  while (i < n) {
    const c = content[i]!;
    if (c === "(") {
      let depth = 1;
      i++;
      let lit = "";
      while (i < n && depth > 0) {
        const ch = content[i]!;
        if (ch === "\\") {
          lit += ch + (content[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        lit += ch;
        i++;
      }
      out.push(decodeLiteral(lit));
    } else if (c === "<" && content[i + 1] !== "<") {
      let j = i + 1;
      let hex = "";
      while (j < n && content[j] !== ">") {
        hex += content[j];
        j++;
      }
      i = j + 1;
      const clean = hex.replace(/[^0-9a-fA-F]/g, "");
      let s = "";
      for (let k = 0; k + 1 < clean.length; k += 2) s += String.fromCharCode(parseInt(clean.slice(k, k + 2), 16));
      out.push(s);
    } else {
      i++;
    }
  }
  return out.join(" ");
}

const IMAGE_HINT = /\/Subtype\s*\/Image|\/DCTDecode|\/CCITTFaxDecode|\/JPXDecode|\/JBIG2Decode/;

export function extractPdfText(pdf: Buffer): string {
  const s = pdf.toString("latin1");
  const results: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(s)) !== null) {
    const start = m.index + m[0].length;
    const endMarker = s.indexOf("endstream", start);
    if (endMarker === -1) continue;

    const dictStart = s.lastIndexOf("<<", m.index);
    const dict = dictStart !== -1 ? s.slice(dictStart, m.index) : "";
    if (IMAGE_HINT.test(dict)) continue;

    // Trim the EOL that precedes `endstream` so it isn't fed to inflate.
    let end = endMarker;
    while (end > start && (pdf[end - 1] === 0x0a || pdf[end - 1] === 0x0d)) end--;
    const rawBytes = pdf.subarray(start, end);

    let content: string | null = null;
    if (/\/FlateDecode/.test(dict)) {
      const inflated = inflate(rawBytes);
      content = inflated ? inflated.toString("latin1") : null;
    } else if (!/\/Filter/.test(dict)) {
      content = rawBytes.toString("latin1");
    }
    if (!content) continue;

    const t = extractText(content);
    if (t.trim()) results.push(t);
  }

  return results
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 20000);
}
