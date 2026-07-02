// URL / YouTube import.
//
// Removes another "bring your own transcript" barrier: paste a YouTube link (or
// a direct .srt/.vtt/.txt URL) and get timestamped lines that drop straight into
// the build box, so the existing segment → cards → shadowing pipeline takes over
// unchanged — exactly like the auto-transcription feature, but sourced from
// captions that already exist.
//
// Provider-agnostic and dependency-free: the network fetch is injectable
// (`fetchImpl`) so the whole feature is unit-testable without hitting YouTube.
// YouTube caption retrieval is inherently best-effort (unofficial endpoint), so
// every failure path resolves to a clear { error } rather than throwing.
//
// SECURITY: this fetches a user-supplied URL server-side, so it guards against
// SSRF — only http(s), and private / loopback / link-local hosts are blocked.

const pad = (n) => String(n).padStart(2, "0");

// Seconds → a bracket timestamp segment.js understands ([mm:ss] or [h:mm:ss]).
function stamp(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0 ? `[${h}:${pad(m)}:${pad(ss)}]` : `[${pad(m)}:${pad(ss)}]`;
}

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);

/** Extract an 11-char YouTube video id from the common URL shapes, or null. */
export function parseYouTubeId(rawUrl) {
  let u;
  try { u = new URL(String(rawUrl)); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const id11 = (s) => (/^[\w-]{11}$/.test(s || "") ? s : null);
  if (host === "youtu.be") return id11(u.pathname.slice(1).split("/")[0]);
  if (!YT_HOSTS.has(host)) return null;
  if (u.pathname === "/watch") return id11(u.searchParams.get("v"));
  const m = u.pathname.match(/^\/(?:shorts|embed|v|live)\/([\w-]{11})/);
  return m ? id11(m[1]) : null;
}

export function isYouTube(rawUrl) {
  return Boolean(parseYouTubeId(rawUrl));
}

// --- SSRF guard ------------------------------------------------------------
function isPrivateIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (m.slice(1).some((n) => Number(n) > 255)) return false;
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||          // link-local (incl. cloud metadata)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)   // CGNAT
  );
}

/** Validate a user-supplied URL for server-side fetching. Throws on rejection. */
export function guardUrl(rawUrl) {
  let u;
  try { u = new URL(String(rawUrl)); } catch { throw new Error("That doesn't look like a valid URL."); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http(s) URLs can be imported.");
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That host isn't allowed.");
  }
  if (host === "::1" || host === "0.0.0.0" || isPrivateIPv4(host)) throw new Error("That host isn't allowed.");
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) throw new Error("That host isn't allowed."); // IPv6 ULA / link-local
  return u;
}

// --- caption parsing (pure) ------------------------------------------------
/** YouTube json3 timedtext → `[mm:ss] text` transcript lines. */
export function timedTextJson3ToTranscript(json) {
  const events = Array.isArray(json?.events) ? json.events : [];
  const lines = [];
  for (const ev of events) {
    if (!Array.isArray(ev.segs)) continue;
    const text = ev.segs.map((s) => s.utf8 ?? "").join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    lines.push(`${stamp((ev.tStartMs ?? 0) / 1000)} ${text}`);
  }
  return lines.join("\n");
}

/** Legacy YouTube XML timedtext → `[mm:ss] text` transcript lines. */
export function timedTextXmlToTranscript(xml) {
  const decode = (s) => String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  const lines = [];
  for (const m of String(xml ?? "").matchAll(/<text[^>]*\bstart="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)) {
    const text = decode(m[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (text) lines.push(`${stamp(Number(m[1]))} ${text}`);
  }
  return lines.join("\n");
}

/** Pull the caption track list + video title out of a watch-page HTML string. */
export function extractCaptionTracks(html) {
  const s = String(html ?? "");
  const start = s.indexOf('"captionTracks"');
  let tracks = [];
  if (start !== -1) {
    const arrStart = s.indexOf("[", start);
    // Walk to the matching ] so we capture the whole (possibly nested) array.
    let depth = 0, end = -1;
    for (let i = arrStart; i < s.length && i < arrStart + 200000; i++) {
      if (s[i] === "[") depth++;
      else if (s[i] === "]" && --depth === 0) { end = i; break; }
    }
    if (end !== -1) {
      try { tracks = JSON.parse(s.slice(arrStart, end + 1)); } catch { tracks = []; }
    }
  }
  const titleMatch = s.match(/"videoDetails":\{[^}]*?"title":"((?:[^"\\]|\\.)*)"/);
  let title = null;
  if (titleMatch) { try { title = JSON.parse(`"${titleMatch[1]}"`); } catch { title = null; } }
  return { tracks: Array.isArray(tracks) ? tracks : [], title };
}

/** Pull caption tracks + title out of a YouTube player-API (innertube) response. */
export function captionTracksFromPlayer(player) {
  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return { tracks: Array.isArray(tracks) ? tracks : [], title: player?.videoDetails?.title || null };
}

/** Choose a caption track: prefer the requested language, then a human (non-asr) track. */
export function pickTrack(tracks, lang) {
  if (!tracks.length) return null;
  const byLang = lang && tracks.find((t) => (t.languageCode || "").toLowerCase().startsWith(lang.toLowerCase()));
  return byLang || tracks.find((t) => t.kind !== "asr") || tracks[0];
}

export function createImporter({ fetchImpl = fetch, maxBytes = 3_000_000, timeoutMs = 15000 } = {}) {
  const enabled = true; // needs only outbound network, which production has

  async function fetchRes(url, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { redirect: "follow", ...opts, signal: ctrl.signal });
      if (!res.ok) throw new Error(`upstream responded ${res.status}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchText(url, headers = {}) {
    const res = await fetchRes(url, { headers });
    const text = await res.text();
    return text.length > maxBytes ? text.slice(0, maxBytes) : text;
  }

  // YouTube's internal "player" API (innertube). More reliable than scraping the
  // watch page and less likely to hit the EU consent wall. Uses the long-lived
  // public web key; the ANDROID client returns caption tracks without cookies.
  async function fetchPlayer(id) {
    const res = await fetchRes(
      "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip" },
        body: JSON.stringify({ context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", hl: "en" } }, videoId: id }),
      },
    );
    return res.json();
  }

  async function importYouTube(id, lang) {
    let tracks = [], title = null, reached = false;
    // 1) Try the player API first (JSON, robust).
    try {
      const player = await fetchPlayer(id);
      reached = true;
      ({ tracks, title } = captionTracksFromPlayer(player));
    } catch { /* fall through to the watch page */ }
    // 2) Fall back to scraping the watch page (with a consent cookie to skip the
    //    EU "before you continue" interstitial).
    if (!tracks.length) {
      try {
        const html = await fetchText(`https://www.youtube.com/watch?v=${id}&hl=en`, {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Cookie": "CONSENT=YES+1; SOCS=CAI",
        });
        reached = true;
        const ex = extractCaptionTracks(html);
        if (ex.tracks.length) tracks = ex.tracks;
        title = title || ex.title;
      } catch { /* handled below */ }
    }
    // Neither source yielded captions: distinguish "video has none" from
    // "YouTube blocked our request" so the message can point somewhere useful.
    if (!tracks.length) return { error: reached ? "no-captions" : "yt-blocked" };

    const track = pickTrack(tracks, lang);
    if (!track?.baseUrl) return { error: "no-captions" };
    const base = track.baseUrl.replace(/&fmt=\w+/, "");
    let raw;
    try { raw = await fetchText(base + "&fmt=json3"); }
    catch { return { error: "yt-blocked" }; }
    let transcript = "";
    try { transcript = timedTextJson3ToTranscript(JSON.parse(raw)); }
    catch { transcript = timedTextXmlToTranscript(raw); }
    if (!transcript.trim()) return { error: "empty-captions" };
    return {
      source: "youtube",
      title: title || `YouTube ${id}`,
      language: track.languageCode || lang || null,
      transcript,
    };
  }

  async function importDirect(u) {
    const text = await fetchText(u.href, { "User-Agent": "Mozilla/5.0 (compatible; EchoDeckBot/1.0)" });
    if (!text.trim()) return { error: "empty" };
    // Only accept things that look like a transcript/subtitles — not arbitrary
    // HTML pages (we can't reliably extract prose from those).
    const looksSubtitle = /-->/.test(text) || /^\s*(WEBVTT|\d+\s*$)/m.test(text);
    const isHtml = /^\s*<(?:!doctype|html)/i.test(text) || /\.html?(?:$|[?#])/i.test(u.pathname);
    if (isHtml && !looksSubtitle) return { error: "unsupported-page" };
    const name = decodeURIComponent(u.pathname.split("/").pop() || "").replace(/\.[^.]+$/, "");
    return { source: "url", title: name || u.hostname, language: null, transcript: text };
  }

  return {
    enabled,
    /**
     * Import a URL into a transcript. Returns { source, title, language,
     * transcript } on success, or { error } (never throws for expected cases).
     */
    async run(rawUrl, { lang } = {}) {
      if (!enabled) return { error: "not-configured" };
      if (!String(rawUrl || "").trim()) return { error: "no-url" };
      let u;
      try { u = guardUrl(rawUrl); } catch (e) { return { error: "blocked", message: e.message }; }
      try {
        const ytId = parseYouTubeId(u.href);
        return ytId ? await importYouTube(ytId, lang) : await importDirect(u);
      } catch (e) {
        return { error: "fetch-failed", message: e.message };
      }
    },
  };
}
