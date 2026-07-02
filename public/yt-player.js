// YouTube shadowing player.
//
// Imported YouTube decks have timestamped cards but no downloadable audio —
// YouTube doesn't allow that. Instead we embed the official player (iframe)
// and drive it with postMessage commands, giving real shadowing loops on the
// actual video. No external script is loaded (CSP script-src stays 'self');
// only frame-src allows the embed.
//
// Pure helpers (parseYouTubeRef, embedUrl, command) are unit-tested in Node;
// createYouTubeLoop touches the DOM and is exercised in the browser smoke.

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtube-nocookie.com"]);
const ID = /^[\w-]{11}$/;

/**
 * Extract a YouTube video id from a deck's audioUrl. Accepts the compact
 * `youtube:<id>` form we store on import, or any pasted YouTube URL
 * (watch / youtu.be / shorts / embed / live). Returns null for anything else
 * (e.g. a normal audio file URL).
 */
export function parseYouTubeRef(audioUrl) {
  const s = String(audioUrl ?? "").trim();
  if (!s) return null;
  const m = s.match(/^youtube:([\w-]{11})$/i);
  if (m) return m[1];
  let u;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (!YT_HOSTS.has(host)) return null;
  const id = (v) => (ID.test(v || "") ? v : null);
  if (host === "youtu.be") return id(u.pathname.slice(1).split("/")[0]);
  if (u.pathname === "/watch") return id(u.searchParams.get("v"));
  const p = u.pathname.match(/^\/(?:shorts|embed|v|live)\/([\w-]{11})/);
  return p ? id(p[1]) : null;
}

/** Privacy-enhanced embed URL with the JS API enabled. */
export function embedUrl(videoId, origin) {
  const u = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  u.searchParams.set("enablejsapi", "1");
  u.searchParams.set("playsinline", "1");
  u.searchParams.set("rel", "0");
  if (origin) u.searchParams.set("origin", origin);
  return u.href;
}

/** Build one player command message (the iframe API's postMessage protocol). */
export function command(func, args = []) {
  return JSON.stringify({ event: "command", func, args });
}

/**
 * Mount a controllable YouTube embed into `container` and return a loop
 * controller with the same shape the <audio> path uses.
 */
export function createYouTubeLoop({ container, videoId, doc = document, win = window }) {
  container.textContent = "";
  const iframe = doc.createElement("iframe");
  iframe.src = embedUrl(videoId, win.location?.origin);
  iframe.allow = "autoplay; encrypted-media; picture-in-picture";
  iframe.allowFullscreen = true;
  iframe.title = "YouTube video for this deck";
  container.appendChild(iframe);

  const post = (msg) => { try { iframe.contentWindow?.postMessage(msg, "https://www.youtube-nocookie.com"); } catch {} };
  // The embed starts relaying/accepting API messages after a "listening" ping.
  const listen = () => post(JSON.stringify({ event: "listening", id: videoId }));
  iframe.addEventListener("load", listen);

  let timer = null;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };

  return {
    kind: "youtube",
    videoId,
    /** Seek to `start`, play at `speed`, pause at `end` (best-effort timing). */
    playLoop(start, end, speed = 1) {
      clear();
      listen(); // harmless if already listening; covers early clicks
      post(command("setPlaybackRate", [speed]));
      post(command("seekTo", [Math.max(0, start ?? 0), true]));
      post(command("playVideo"));
      const stopAt = end ?? (start != null ? start + 8 : null);
      if (stopAt != null && start != null && stopAt > start) {
        timer = setTimeout(() => post(command("pauseVideo")), ((stopAt - start) / speed) * 1000);
      }
    },
    stop() {
      clear();
      post(command("pauseVideo"));
    },
    destroy() {
      clear();
      iframe.remove();
    },
  };
}
