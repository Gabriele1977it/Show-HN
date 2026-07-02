// EchoDeck no-signup demo.
//
// Calls the stateless /api/demo/* endpoints (no account, no persistence) so a
// first-time visitor can paste any text and watch the real segmentation + cloze
// engine turn it into study cards, then try in-browser pronunciation scoring.
// Card text is rendered with textContent / DOM nodes (never innerHTML) so a
// pasted transcript can't inject markup.

const $ = (sel) => document.querySelector(sel);

// A few ready-to-run samples. Japanese uses timestamps so cards show timecodes.
const SAMPLES = [
  {
    label: "🇪🇸 Spanish",
    lang: "es-ES",
    text: [
      "Hoy hace muy buen tiempo en la ciudad.",
      "Me gustaría reservar una mesa para dos personas.",
      "El tren de la mañana llega con un poco de retraso.",
      "¿Podrías repetir la última frase más despacio, por favor?",
    ].join("\n"),
  },
  {
    label: "🇫🇷 French",
    lang: "fr-FR",
    text: [
      "Je voudrais un café et un croissant, s'il vous plaît.",
      "Le musée est fermé le lundi mais ouvert le week-end.",
      "Pouvez-vous m'indiquer le chemin vers la gare ?",
      "Cette chanson me rappelle mon voyage à Lyon.",
    ].join("\n"),
  },
  {
    label: "🇯🇵 Japanese",
    lang: "ja-JP",
    text: [
      "[00:00] 今日は天気がいいです。",
      "[00:04] 週末は雨が降るかもしれません。",
      "[00:09] 電車が少し遅れています。",
      "[00:13] コーヒーを一杯ください。",
    ].join("\n"),
  },
  {
    label: "🇬🇧 English",
    lang: "en-US",
    text: [
      "Learning a language is mostly about showing up every single day.",
      "Could you speak a little more slowly, please?",
      "The best way to remember a phrase is to use it out loud.",
    ].join("\n"),
  },
];

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function renderSamples() {
  const host = $("#samples");
  for (const s of SAMPLES) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = s.label;
    chip.addEventListener("click", () => {
      $("#transcript").value = s.text;
      $("#reclang").value = s.lang;
      build();
    });
    host.appendChild(chip);
  }
}

async function build() {
  const transcript = $("#transcript").value;
  const err = $("#demo-error");
  err.textContent = "";
  const btn = $("#build");
  if (!transcript.trim()) { err.textContent = "Paste some text, subtitles, or a transcript first."; return; }
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = "Building…";
  try {
    const r = await fetch("/api/demo/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Couldn't build cards. Try shorter text.");
    renderCards(data);
  } catch (e) {
    err.textContent = e.message;
  } finally {
    btn.textContent = label;
    btn.disabled = false;
  }
}

function fmtRange(start, end) {
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  if (start == null) return null;
  return end != null ? `⏱ ${mmss(start)}–${mmss(end)}` : `⏱ ${mmss(start)}`;
}

function renderCards({ segments, total, truncated }) {
  const host = $("#cards");
  host.textContent = "";
  segments.forEach((seg, i) => host.appendChild(buildCard(seg, i)));
  if (truncated) {
    const note = document.createElement("div");
    note.className = "hint";
    note.style.textAlign = "center";
    note.textContent = `Showing the first ${segments.length} of ${total} cards — sign up free to build the whole deck.`;
    host.appendChild(note);
  }
  $("#demo-cta").style.display = segments.length ? "block" : "none";
}

function buildCard(seg, i) {
  const card = document.createElement("div");
  card.className = "card";

  const meta = document.createElement("div");
  meta.className = "meta";
  const idx = document.createElement("span");
  idx.textContent = `#${i + 1}`;
  meta.appendChild(idx);
  const range = fmtRange(seg.start, seg.end);
  if (range) { const r = document.createElement("span"); r.textContent = range; meta.appendChild(r); }
  if (seg.cloze) { const c = document.createElement("span"); c.textContent = "fill in the blank"; meta.appendChild(c); }
  card.appendChild(meta);

  const front = document.createElement("div");
  front.className = "front";
  if (seg.cloze) {
    // masked text contains the full-width blank ＿＿＿; highlight that run.
    const parts = seg.cloze.masked.split("＿＿＿");
    front.appendChild(document.createTextNode(parts[0]));
    const blank = document.createElement("span");
    blank.className = "blank";
    blank.textContent = "＿＿＿";
    front.appendChild(blank);
    front.appendChild(document.createTextNode(parts.slice(1).join("＿＿＿")));
  } else {
    front.textContent = seg.text;
  }
  card.appendChild(front);

  const answer = document.createElement("div");
  answer.className = "answer";
  answer.textContent = seg.cloze ? `${seg.text}  (answer: ${seg.cloze.answer})` : seg.text;
  card.appendChild(answer);

  const tools = document.createElement("div");
  tools.className = "tools";
  if (seg.cloze) {
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.textContent = "Reveal";
    reveal.addEventListener("click", () => {
      const on = card.classList.toggle("revealed");
      reveal.textContent = on ? "Hide" : "Reveal";
    });
    tools.appendChild(reveal);
  }
  if (SpeechRecognition) {
    const shadow = document.createElement("button");
    shadow.type = "button";
    shadow.textContent = "🎤 Shadow & score";
    shadow.addEventListener("click", () => shadowAndScore(card, seg.text, shadow));
    tools.appendChild(shadow);
  }
  card.appendChild(tools);

  const score = document.createElement("div");
  score.className = "score";
  card.appendChild(score);

  return card;
}

function shadowAndScore(card, target, btn) {
  const rec = new SpeechRecognition();
  rec.lang = $("#reclang").value || "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  const label = btn.textContent;
  btn.textContent = "Listening…";
  btn.classList.add("rec");
  btn.disabled = true;
  const done = () => { btn.textContent = label; btn.classList.remove("rec"); btn.disabled = false; };

  rec.onerror = (e) => {
    done();
    const s = card.querySelector(".score");
    card.classList.add("scored");
    s.textContent = e.error === "not-allowed"
      ? "Microphone permission is needed to score your speech."
      : "Couldn't capture audio — try again.";
  };
  rec.onresult = async (ev) => {
    done();
    const heard = ev.results?.[0]?.[0]?.transcript ?? "";
    try {
      const r = await fetch("/api/demo/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, heard }),
      });
      const data = await r.json();
      renderScore(card, data, heard);
    } catch {
      const s = card.querySelector(".score");
      card.classList.add("scored");
      s.textContent = "Scoring failed — please try again.";
    }
  };
  try { rec.start(); } catch { done(); }
}

function renderScore(card, data, heard) {
  const s = card.querySelector(".score");
  s.textContent = "";
  card.classList.add("scored");

  const head = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = `Score: ${data.score}%`;
  head.appendChild(strong);
  const grade = document.createElement("span");
  grade.className = "grade";
  grade.textContent = `  · suggested review: ${data.suggestedGrade}`;
  head.appendChild(grade);
  s.appendChild(head);

  if (Array.isArray(data.words) && data.words.length) {
    const line = document.createElement("div");
    line.style.marginTop = "4px";
    data.words.forEach((w, i) => {
      const tok = document.createElement("span");
      tok.className = w.ok ? "tok-ok" : "tok-miss";
      tok.textContent = (i ? " " : "") + w.token;
      line.appendChild(tok);
    });
    s.appendChild(line);
  }
  const heardLine = document.createElement("div");
  heardLine.className = "grade";
  heardLine.style.marginTop = "4px";
  heardLine.textContent = heard ? `Heard: “${heard}”` : "Heard nothing — try speaking closer to the mic.";
  s.appendChild(heardLine);
}

renderSamples();
$("#build").addEventListener("click", build);
// Prefill with the first sample and build immediately so the page shows value
// on arrival with zero clicks.
$("#transcript").value = SAMPLES[0].text;
$("#reclang").value = SAMPLES[0].lang;
build();
