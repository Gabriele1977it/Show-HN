// EchoDeck client.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const api = {
  async get(url) { return handle(await fetch(url)); },
  async post(url, body) {
    return handle(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  },
  async patch(url, body) {
    return handle(await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  },
  async del(url) { const r = await fetch(url, { method: "DELETE" }); if (!r.ok) throw new Error("Request failed"); },
};
async function handle(r) {
  if (!r.ok) {
    let msg = "Request failed";
    try { msg = (await r.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return r.status === 204 ? null : r.json();
}

const fmtTime = (s) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};
const fmtDue = (ms) => {
  const d = ms - Date.now();
  if (d <= 0) return "due now";
  const days = Math.round(d / 86400000);
  if (days >= 1) return `in ${days}d`;
  const hrs = Math.round(d / 3600000);
  return hrs >= 1 ? `in ${hrs}h` : `in ${Math.max(1, Math.round(d / 60000))}m`;
};

const state = { deck: null, player: $("#player") };

// ---- view switching ----
$$(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.classList.toggle("is-active", x === t));
    $$(".view").forEach((v) => v.classList.toggle("is-active", v.id === `view-${t.dataset.view}`));
    if (t.dataset.view === "alerts") loadAlerts();
  }),
);
function goStudy() {
  $$(".tab").forEach((x) => x.classList.toggle("is-active", x.dataset.view === "study"));
  $$(".view").forEach((v) => v.classList.toggle("is-active", v.id === "view-study"));
}

// ---- audio upload ----
$("#uploadBtn").addEventListener("click", () => $("#audioFile").click());
$("#audioFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $("#uploadStatus").textContent = "Uploading…";
  try {
    const fd = new FormData();
    fd.append("audio", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    if (!r.ok) throw new Error("Upload rejected (audio files only).");
    const { url } = await r.json();
    $("#audioUrl").value = url;
    $("#uploadStatus").textContent = `Uploaded ${file.name}`;
  } catch (err) {
    $("#uploadStatus").textContent = err.message;
  }
});

// ---- subtitle import (reads file text straight into the transcript box) ----
$("#subBtn").addEventListener("click", () => $("#subFile").click());
$("#subFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const ta = $("#build-form").transcript;
  ta.value = ta.value.trim() ? ta.value.trimEnd() + "\n\n" + text : text;
  if (!$("#build-form").title.value.trim()) {
    $("#build-form").title.value = file.name.replace(/\.[^.]+$/, "");
  }
  e.target.value = "";
});

// ---- build deck ----
$("#build-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#build-error").textContent = "";
  const f = e.target;
  const payload = {
    title: f.title.value,
    language: f.language.value,
    audioUrl: f.audioUrl.value.trim() || null,
    transcript: f.transcript.value,
    maxChars: Number(f.maxChars.value) || 180,
  };
  if (!payload.transcript.trim()) {
    $("#build-error").textContent = "Add a transcript to build cards from.";
    return;
  }
  try {
    const deck = await api.post("/api/decks", payload);
    f.reset();
    f.maxChars.value = 180;
    $("#uploadStatus").textContent = "";
    await loadDecks();
    openDeck(deck.id);
  } catch (err) {
    $("#build-error").textContent = err.message;
  }
});

// ---- deck list ----
async function loadDecks() {
  const decks = await api.get("/api/decks");
  const ul = $("#deck-list");
  ul.innerHTML = "";
  if (!decks.length) {
    ul.innerHTML = `<li class="muted small">No decks yet — build one on the left.</li>`;
    return;
  }
  for (const d of decks) {
    const li = document.createElement("li");
    li.className = "deck-item";
    li.innerHTML = `
      <div>
        <div class="title">${esc(d.title)}</div>
        <div class="sub">${esc(d.language || "—")} · ${d.cardCount} cards
          ${d.dueCount ? `· <span class="pill">${d.dueCount} due</span>` : ""}</div>
      </div>
      <div class="row">
        <button class="open">Open ▸</button>
        <button class="del" title="Delete">🗑</button>
      </div>`;
    $(".open", li).addEventListener("click", () => openDeck(d.id));
    $(".del", li).addEventListener("click", async () => {
      if (confirm(`Delete "${d.title}"?`)) { await api.del(`/api/decks/${d.id}`); await loadDecks(); if (state.deck?.id === d.id) resetStudy(); }
    });
    ul.appendChild(li);
  }
  refreshBadge();
}

// ---- deck detail ----
async function openDeck(id) {
  state.deck = await api.get(`/api/decks/${id}`);
  goStudy();
  renderDeck();
  refreshBadge();
}
function resetStudy() {
  state.deck = null;
  $("#study-deck").classList.add("hidden");
  $("#study-empty").classList.remove("hidden");
}
function renderDeck() {
  const d = state.deck;
  $("#study-empty").classList.add("hidden");
  $("#study-deck").classList.remove("hidden");
  $("#study-title").textContent = d.title;
  const dueCount = d.cards.filter((c) => c.srs.due <= Date.now()).length;
  $("#study-meta").textContent = `${esc(d.language || "—")} · ${d.cards.length} cards · ${d.audioUrl ? "audio attached" : "no audio"}`;
  $("#due-badge").textContent = dueCount;
  if (d.audioUrl) state.player.src = d.audioUrl;

  const list = $("#card-list");
  list.innerHTML = "";
  d.cards.forEach((c, i) => list.appendChild(renderCard(c, i)));
}

function renderCard(card, idx) {
  const el = document.createElement("div");
  el.className = "scard";
  const hasAudio = state.deck.audioUrl && card.start != null;
  const due = card.srs.due <= Date.now();
  el.innerHTML = `
    <div class="front">${esc(card.front)}</div>
    <div class="meta">
      <span>#${idx + 1}</span>
      <span class="timecode">⏱ ${fmtTime(card.start)}–${fmtTime(card.end)}</span>
      <span>${due ? '<span class="due-dot"></span> due now' : "next " + fmtDue(card.srs.due)}</span>
      <span>reps ${card.srs.reps}</span>
    </div>
    <input class="back-input" placeholder="Translation / meaning (back of card)" value="${esc(card.back)}" />
    <div class="tools">
      ${hasAudio ? '<button class="play">▶ Shadow loop</button>' : ""}
      <button class="save ghost">Save back</button>
    </div>`;
  const backInput = $(".back-input", el);
  $(".save", el).addEventListener("click", async () => {
    const updated = await api.patch(`/api/cards/${card.id}`, { back: backInput.value });
    card.back = updated.back;
    flash($(".save", el), "Saved ✓");
  });
  if (hasAudio) $(".play", el).addEventListener("click", () => playLoop(card.start, card.end));
  return el;
}

// ---- shadowing playback ----
let loopStop = null;
function playLoop(start, end, speed = 1) {
  const p = state.player;
  if (!p.src) return;
  if (loopStop) loopStop();
  p.playbackRate = speed;
  p.currentTime = start ?? 0;
  const stopAt = end ?? (start != null ? start + 8 : null);
  const onTime = () => { if (stopAt != null && p.currentTime >= stopAt) { p.pause(); cleanup(); } };
  const cleanup = () => { p.removeEventListener("timeupdate", onTime); loopStop = null; };
  loopStop = () => { p.pause(); cleanup(); };
  p.addEventListener("timeupdate", onTime);
  p.play().catch(() => {});
}

// ---- export ----
$("#export-btn").addEventListener("click", () => {
  if (!state.deck) return;
  const fmt = $("#export-format").value;
  window.location.href = `/api/decks/${state.deck.id}/export?format=${fmt}`;
});

// ---- review session ----
const review = { queue: [], idx: 0 };
$("#review-btn").addEventListener("click", startReview);
$("#review-close").addEventListener("click", closeReview);
$("#show-answer").addEventListener("click", showAnswer);
$("#rev-play").addEventListener("click", () => {
  const c = review.queue[review.idx];
  if (c) playLoop(c.start, c.end, Number($("#rev-speed").value));
});
$$("#grade-buttons button").forEach((b) =>
  b.addEventListener("click", () => gradeCard(b.dataset.grade)),
);

async function startReview() {
  if (!state.deck) return;
  review.queue = await api.get(`/api/decks/${state.deck.id}/due`);
  review.idx = 0;
  if (!review.queue.length) { alert("Nothing due right now — come back later or add more cards."); return; }
  $("#review-overlay").classList.remove("hidden");
  showCard();
}
function showCard() {
  const c = review.queue[review.idx];
  if (!c) return closeReview(true);
  $("#review-count").textContent = `${review.idx + 1} / ${review.queue.length}`;
  $("#review-front").textContent = c.front;
  $("#review-back").textContent = c.back || "(no translation yet)";
  $("#review-back").classList.add("hidden");
  $("#grade-buttons").classList.add("hidden");
  $("#show-answer").classList.remove("hidden");
  $("#review-shadow").classList.toggle("hidden", !(state.deck.audioUrl && c.start != null));
}
function showAnswer() {
  $("#review-back").classList.remove("hidden");
  $("#show-answer").classList.add("hidden");
  $("#grade-buttons").classList.remove("hidden");
}
async function gradeCard(grade) {
  const c = review.queue[review.idx];
  await api.post(`/api/cards/${c.id}/review`, { grade });
  review.idx += 1;
  if (review.idx >= review.queue.length) {
    closeReview(true);
    await openDeck(state.deck.id);
  } else {
    showCard();
  }
}
function closeReview(done) {
  if (loopStop) loopStop();
  $("#review-overlay").classList.add("hidden");
  if (done) renderDeck();
}

// ---- alerts ----
$("#alert-refresh").addEventListener("click", loadAlerts);
$("#reminder-test").addEventListener("click", sendTestReminder);

async function loadReminderPanel() {
  const status = $("#reminder-status");
  const pre = $("#reminder-preview");
  const testBtn = $("#reminder-test");
  try {
    const r = await api.get("/api/reminders/preview");
    if (!r.enabled) {
      status.textContent = "Reminders are not configured on this server.";
      pre.classList.add("hidden");
      testBtn.disabled = true;
      return;
    }
    testBtn.disabled = false;
    const hrs = Math.round((r.config.minIntervalMs / 3600000) * 10) / 10;
    if (r.message) {
      status.innerHTML = `${r.wouldSend ? "A reminder is ready to send" : "Throttled — already sent recently"} · at most once / ${hrs}h.`;
      pre.textContent = `${r.message.title}\n\n${r.message.body}`;
      pre.classList.remove("hidden");
    } else {
      status.textContent = `Nothing due — no reminder pending. Sends at most once / ${hrs}h when cards are due.`;
      pre.classList.add("hidden");
    }
  } catch {
    status.textContent = "Could not load reminder status.";
  }
}

async function sendTestReminder() {
  const btn = $("#reminder-test");
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "Sending…";
  try {
    const res = await api.post("/api/reminders/test", {});
    btn.textContent = res.sent ? "Sent ✓" : "Nothing due";
  } catch (err) {
    btn.textContent = "Failed";
    $("#reminder-status").textContent = err.message;
  }
  setTimeout(() => { btn.textContent = old; btn.disabled = false; loadReminderPanel(); }, 1400);
}

async function refreshBadge() {
  try {
    const s = await api.get("/api/alerts");
    const badge = $("#alert-badge");
    badge.textContent = s.totalDue;
    badge.classList.toggle("hidden", s.totalDue === 0);
    return s;
  } catch { return null; }
}

async function loadAlerts() {
  loadReminderPanel();
  const s = await refreshBadge();
  const list = $("#alert-list");
  const summary = $("#alert-summary");
  if (!s) { summary.textContent = "Could not load alerts."; return; }

  if (s.totalDue > 0) {
    summary.innerHTML = `<strong>${s.totalDue}</strong> card${s.totalDue === 1 ? "" : "s"} due across ${s.decksDue.length} deck${s.decksDue.length === 1 ? "" : "s"}.`;
  } else if (s.nextDue) {
    summary.textContent = `All caught up — next card due ${fmtDue(s.nextDue)}.`;
  } else if (s.deckCount === 0) {
    summary.textContent = "No decks yet. Build one to start studying.";
  } else {
    summary.textContent = "All caught up — nothing scheduled.";
  }

  list.innerHTML = "";
  for (const d of s.decksDue) {
    const li = document.createElement("li");
    li.className = "deck-item";
    li.innerHTML = `
      <div>
        <div class="title">${esc(d.title)}</div>
        <div class="sub">${esc(d.language || "—")} · ${d.cardCount} cards</div>
      </div>
      <div class="row">
        <span class="pill">${d.dueCount} due</span>
        <button class="open">Review ▸</button>
      </div>`;
    $(".open", li).addEventListener("click", () => reviewDeck(d.id));
    list.appendChild(li);
  }
}

async function reviewDeck(id) {
  await openDeck(id);
  startReview();
}

// ---- helpers ----
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = old), 1200);
}

loadDecks();
