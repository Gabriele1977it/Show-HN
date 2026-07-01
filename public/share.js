// Public read-only shared-deck viewer.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtTime = (s) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`);
const mask = (text, term) => { const i = text.indexOf(term); return i === -1 ? text : text.slice(0, i) + "＿＿＿" + text.slice(i + term.length); };
const hl = (text, term) => { const i = text.indexOf(term); return i === -1 ? esc(text) : esc(text.slice(0, i)) + `<mark>${esc(term)}</mark>` + esc(text.slice(i + term.length)); };
const shareId = location.pathname.split("/").filter(Boolean).pop();
const player = $("#player");

let loopStop = null;
function playLoop(start, end, speed = 1) {
  if (!player.src) return;
  if (loopStop) loopStop();
  player.playbackRate = speed;
  player.currentTime = start ?? 0;
  const stopAt = end ?? (start != null ? start + 8 : null);
  const onTime = () => { if (stopAt != null && player.currentTime >= stopAt) { player.pause(); cleanup(); } };
  const cleanup = () => { player.removeEventListener("timeupdate", onTime); loopStop = null; };
  loopStop = () => { player.pause(); cleanup(); };
  player.addEventListener("timeupdate", onTime);
  player.play().catch(() => {});
}

async function load() {
  let deck;
  try {
    const r = await fetch(`/api/shared/${shareId}`);
    if (!r.ok) throw new Error();
    deck = await r.json();
  } catch {
    $("#share-title").textContent = "Deck not found";
    $("#share-meta").textContent = "This shared link is invalid or has been unpublished.";
    return;
  }

  document.title = `${deck.title} — EchoDeck`;
  $("#share-title").textContent = deck.title;
  $("#share-meta").textContent = `${deck.language || "—"} · ${deck.cards.length} cards · ${deck.audioUrl ? "audio attached" : "no audio"}`;
  $("#share-actions").style.display = "flex";
  if (deck.audioUrl) player.src = deck.audioUrl;

  const list = $("#share-cards");
  list.innerHTML = "";
  deck.cards.forEach((c, i) => {
    const hasAudio = deck.audioUrl && c.start != null;
    const el = document.createElement("div");
    el.className = "scard";
    el.innerHTML = `
      <div class="front">${c.cloze ? esc(mask(c.front, c.cloze)) : esc(c.front)}</div>
      <div class="meta">
        <span>#${i + 1}</span>
        <span class="timecode">⏱ ${fmtTime(c.start)}–${fmtTime(c.end)}</span>
        ${c.cloze ? '<span class="deck-chip">fill in the blank</span>' : ""}
      </div>
      <div class="tools">
        ${hasAudio ? '<button class="play ghost">▶ Shadow loop</button>' : ""}
        <button class="reveal ghost">${c.cloze ? "Reveal" : "Show meaning"}</button>
      </div>
      <div class="back hidden" style="margin-top:10px;color:var(--accent-2)"></div>`;
    const back = el.querySelector(".back");
    el.querySelector(".reveal").addEventListener("click", (e) => {
      const hidden = back.classList.toggle("hidden");
      let html = "";
      if (c.cloze) html += `<div style="color:var(--ink)">${hl(c.front, c.cloze)}</div>`;
      if (c.back) html += `<div style="margin-top:6px">${esc(c.back)}</div>`;
      back.innerHTML = html || "(no translation provided)";
      e.target.textContent = hidden ? (c.cloze ? "Reveal" : "Show meaning") : "Hide";
    });
    if (hasAudio) el.querySelector(".play").addEventListener("click", () => playLoop(c.start, c.end));
    list.appendChild(el);
  });

  $("#share-foot").innerHTML = `Made with <a href="/" style="color:var(--accent)">EchoDeck</a> — build your own audio flashcards.`;
  $("#export-btn").addEventListener("click", () => {
    window.location.href = `/api/shared/${shareId}/export?format=${$("#export-format").value}`;
  });
}

load();
