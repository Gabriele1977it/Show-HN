// Audio → transcript (auto-transcription).
//
// Removes the hard prerequisite of "already have a transcript": point at an
// audio URL and get timestamped lines that drop straight into the build box,
// so the existing segment → cards → shadowing pipeline takes over unchanged.
//
// Provider-agnostic, mirroring email/reminders/enrich: set TRANSCRIBE_WEBHOOK_URL
// to any speech-to-text endpoint (Whisper API, Deepgram, AssemblyAI, a
// self-hosted whisper.cpp behind a relay, Replicate, …). The webhook receives
// { audioUrl } and returns either { segments: [{start,end,text}] } (preferred —
// gives real shadowing loops) or { text }. An injectable `transcribe` function
// keeps the whole feature testable without a provider; with nothing configured
// the service reports disabled and the route returns a clear message.

const pad = (n) => String(n).padStart(2, "0");

// Seconds → a bracket timestamp segment.js understands ([mm:ss] or [h:mm:ss]).
function stamp(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0 ? `[${h}:${pad(m)}:${pad(ss)}]` : `[${pad(m)}:${pad(ss)}]`;
}

// Turn a provider response into { segments, transcript }. Timestamped segments
// become `[mm:ss] text` lines; a plain `text` payload is passed through as-is
// (segmented into sentence cards downstream).
export function normalizeTranscript(data) {
  if (Array.isArray(data?.segments) && data.segments.length) {
    const segments = data.segments
      .map((g) => ({ start: Number(g.start) || 0, end: g.end != null ? Number(g.end) : null, text: String(g.text ?? "").trim() }))
      .filter((g) => g.text);
    return { segments, transcript: segments.map((g) => `${stamp(g.start)} ${g.text}`).join("\n") };
  }
  return { segments: [], transcript: String(data?.text ?? "").trim() };
}

export function createTranscriber({ webhookUrl, fetchImpl = fetch, transcribe } = {}) {
  const enabled = Boolean(transcribe || webhookUrl);

  async function callWebhook(audioUrl) {
    const res = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioUrl }),
    });
    if (!res.ok) throw new Error(`Transcription webhook responded ${res.status}`);
    return res.json();
  }

  const fn = transcribe || callWebhook;

  return {
    enabled,
    // Returns { segments, transcript } or { error }.
    async run(audioUrl) {
      if (!enabled) return { error: "not-configured" };
      if (!String(audioUrl || "").trim()) return { error: "no-audio" };
      return normalizeTranscript(await fn(audioUrl));
    },
  };
}
