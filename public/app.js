// EchoDeck client.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// --- workspace auth ---
const WS_KEY = "echodeck_ws_key";
const WS_NAME = "echodeck_ws_name";
const SESSION = "echodeck_session";
let wsKey = localStorage.getItem(WS_KEY) || "";
let sessionToken = localStorage.getItem(SESSION) || "";
const authHeaders = (extra = {}) => (wsKey ? { Authorization: `Bearer ${wsKey}`, ...extra } : extra);

const api = {
  async get(url) { return handle(await fetch(url, { headers: authHeaders() })); },
  async post(url, body) {
    return handle(await fetch(url, { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(body) }));
  },
  async patch(url, body) {
    return handle(await fetch(url, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(body) }));
  },
  async del(url) { const r = await fetch(url, { method: "DELETE", headers: authHeaders() }); if (!r.ok) throw new Error("Request failed"); },
};
async function handle(r) {
  if (!r.ok) {
    let data = {};
    try { data = await r.json(); } catch {}
    const err = new Error(data.error || "Request failed");
    err.status = r.status;
    err.upgrade = Boolean(data.upgrade) || r.status === 402;
    throw err;
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
    if (t.dataset.view === "stats") loadStats();
    if (t.dataset.view === "pricing") loadPricing();
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
    const r = await fetch("/api/upload", { method: "POST", headers: authHeaders(), body: fd });
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
    showBuildError(err);
  }
});

function showBuildError(err) {
  const el = $("#build-error");
  el.innerHTML = "";
  el.append(err.message + " ");
  if (err.upgrade) {
    const a = document.createElement("a");
    a.href = "#"; a.textContent = "See plans →"; a.style.color = "var(--accent-2)";
    a.addEventListener("click", (e) => { e.preventDefault(); showView("pricing"); loadPricing(); });
    el.append(a);
  }
}

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

  if (d.shareId) showShareBar(`${location.origin}/s/${d.shareId}`);
  else $("#share-bar").classList.add("hidden");

  const list = $("#card-list");
  list.innerHTML = "";
  d.cards.forEach((c, i) => list.appendChild(renderCard(c, i)));
}

function renderCard(card, idx) {
  const el = document.createElement("div");
  el.className = "scard";
  el.dataset.cardId = card.id;
  const hasAudio = state.deck.audioUrl && card.start != null;
  const due = card.srs.due <= Date.now();
  el.innerHTML = `
    <div class="front">${esc(card.front)}</div>
    <div class="meta">
      <span>#${idx + 1}</span>
      <span class="timecode">⏱ ${fmtTime(card.start)}–${fmtTime(card.end)}</span>
      <span>${due ? '<span class="due-dot"></span> due now' : "next " + fmtDue(card.srs.due)}</span>
      <span>reps ${card.srs.reps}</span>
      ${card.cloze ? `<span class="cloze-chip">blank: ${esc(card.cloze)} <button class="cloze-x" title="Clear cloze">×</button></span>` : ""}
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
  const clozeX = $(".cloze-x", el);
  if (clozeX) clozeX.addEventListener("click", async () => {
    await api.patch(`/api/cards/${card.id}`, { cloze: null });
    card.cloze = null;
    el.replaceWith(renderCard(card, idx));
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

// ---- cloze (fill-in-the-blank) ----
$("#cloze-btn").addEventListener("click", async () => {
  if (!state.deck) return;
  const btn = $("#cloze-btn");
  btn.disabled = true;
  const res = await api.post(`/api/decks/${state.deck.id}/cloze`, {});
  state.deck = res.deck;
  renderDeck();
  btn.disabled = false;
  flash(btn, res.updated ? `Cloze +${res.updated}` : "All set");
});

// ---- sharing ----
$("#share-btn").addEventListener("click", async () => {
  if (!state.deck) return;
  const { shareUrl } = await api.post(`/api/decks/${state.deck.id}/share`, {});
  state.deck.shareId = shareUrl.split("/").pop();
  showShareBar(shareUrl);
});
$("#share-off").addEventListener("click", async () => {
  if (!state.deck) return;
  await api.del(`/api/decks/${state.deck.id}/share`);
  state.deck.shareId = null;
  $("#share-bar").classList.add("hidden");
});
$("#share-copy").addEventListener("click", async () => {
  const input = $("#share-url");
  try { await navigator.clipboard.writeText(input.value); flash($("#share-copy"), "Copied ✓"); }
  catch { input.select(); document.execCommand("copy"); flash($("#share-copy"), "Copied ✓"); }
});

function showShareBar(url) {
  $("#share-url").value = url;
  $("#share-open").href = url;
  $("#share-bar").classList.remove("hidden");
}

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
  // With a cloze term, the prompt is the sentence with the term blanked out.
  $("#review-front").textContent = c.cloze ? maskCloze(c.front, c.cloze) : c.front;
  $("#review-back").classList.add("hidden");
  $("#grade-buttons").classList.add("hidden");
  $("#show-answer").classList.remove("hidden");
  $("#review-shadow").classList.toggle("hidden", !(state.deck.audioUrl && c.start != null));
}
function showAnswer() {
  const c = review.queue[review.idx];
  let html = "";
  // Reveal the full sentence with the blanked term highlighted (cloze cards).
  if (c.cloze) html += `<div>${highlightTerm(c.front, c.cloze)}</div>`;
  if (c.back) html += `<div style="margin-top:6px">${esc(c.back)}</div>`;
  $("#review-back").innerHTML = html || "(no translation yet)";
  $("#review-back").classList.remove("hidden");
  $("#show-answer").classList.add("hidden");
  $("#grade-buttons").classList.remove("hidden");
}
function maskCloze(text, term) {
  const i = text.indexOf(term);
  return i === -1 ? text : text.slice(0, i) + "＿＿＿" + text.slice(i + term.length);
}
function highlightTerm(text, term) {
  const i = text.indexOf(term);
  if (i === -1) return esc(text);
  return esc(text.slice(0, i)) + `<mark>${esc(term)}</mark>` + esc(text.slice(i + term.length));
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

// ---- cross-deck search ----
let searchTimer = null;
$("#search-box").addEventListener("input", (e) => {
  const q = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(q), 200);
});
$("#search-clear").addEventListener("click", () => {
  $("#search-box").value = "";
  showView("build");
});

function showView(name) {
  $$(".tab").forEach((x) => x.classList.toggle("is-active", x.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("is-active", v.id === `view-${name}`));
}

async function runSearch(q) {
  if (!q.trim()) { if ($("#view-search").classList.contains("is-active")) showView("build"); return; }
  showView("search");
  let results;
  try { results = await api.get(`/api/search?q=${encodeURIComponent(q)}`); } catch { return; }
  $("#search-title").textContent = `Search — ${results.length} result${results.length === 1 ? "" : "s"} for “${q}”`;
  const host = $("#search-results");
  host.innerHTML = "";
  if (!results.length) {
    host.innerHTML = `<p class="muted small">No cards match. Try a different word.</p>`;
    return;
  }
  for (const r of results) {
    const el = document.createElement("div");
    el.className = "scard";
    const hasAudio = r.start != null;
    el.innerHTML = `
      <div class="meta" style="margin-bottom:6px"><span class="deck-chip">${esc(r.deckTitle)}</span><span>${esc(r.language || "")}</span></div>
      <div class="front">${highlight(r.front, q)}</div>
      ${r.back ? `<div class="meta" style="margin-top:6px;color:var(--accent-2)">${highlight(r.back, q)}</div>` : ""}
      <div class="tools"><button class="open ghost">Open in deck ▸</button></div>`;
    el.querySelector(".open").addEventListener("click", () => openToCard(r.deckId, r.cardId));
    host.appendChild(el);
  }
}

async function openToCard(deckId, cardId) {
  await openDeck(deckId);
  requestAnimationFrame(() => {
    const card = document.querySelector(`#card-list .scard[data-card-id="${cardId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.remove("flash-hit");
      void card.offsetWidth; // restart animation
      card.classList.add("flash-hit");
    }
  });
}

function highlight(text, q) {
  const safe = esc(text);
  const needle = q.trim();
  if (!needle) return safe;
  const re = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return safe.replace(re, "<mark>$1</mark>");
}

// ---- pricing & upgrades ----
$("#ws-upgrade").addEventListener("click", () => { $("#ws-panel").classList.add("hidden"); showView("pricing"); loadPricing(); });

$("#manage-btn").addEventListener("click", async () => {
  const btn = $("#manage-btn");
  btn.disabled = true;
  try {
    const r = await api.post("/api/billing/portal", {});
    if (r.dev) { $("#pricing-msg").textContent = "Subscription cancelled (dev mode)."; await loadWorkspaceInfo(); loadPricing(); }
    else if (r.url) window.location.href = r.url;
  } catch (err) {
    btn.disabled = false;
    $("#pricing-msg").textContent = err.status === 403 ? "Only an admin can manage billing." : err.message;
  }
});

let currentPlan = "free";
async function loadPricing() {
  let plans, ws;
  try { [plans, ws] = await Promise.all([api.get("/api/plans"), api.get("/api/workspace")]); } catch { return; }
  currentPlan = ws.plan;
  $("#pricing-current").textContent = `You're on the ${ws.planInfo.name} plan · ${ws.usage.decks} decks · ${ws.usage.cards} cards`;
  $("#manage-btn").classList.toggle("hidden", ws.plan === "free");
  $("#pricing-msg").textContent = "";
  const host = $("#pricing-cards");
  host.innerHTML = "";
  const featLabel = { sharing: "Public deck sharing", reminders: "Review reminders", stats: "Study dashboard" };
  for (const p of plans) {
    const isCurrent = p.id === currentPlan;
    const card = document.createElement("div");
    card.className = `plan-card${isCurrent ? " current" : ""}${p.id === "pro" ? " featured" : ""}`;
    const limit = (v, unit) => (v === null ? `Unlimited ${unit}` : `${v} ${unit}`);
    const feats = Object.keys(featLabel)
      .map((f) => `<li class="${p.features[f] ? "" : "off"}">${featLabel[f]}</li>`)
      .join("");
    card.innerHTML = `
      ${p.id === "pro" ? '<span class="plan-badge">Most popular</span>' : ""}
      <h3>${p.name}</h3>
      <div class="price">${p.price === 0 ? "Free" : "$" + p.price}<span>${p.price === 0 ? "" : "/mo"}</span></div>
      <div class="blurb">${esc(p.blurb)}</div>
      <ul>
        <li>${limit(p.maxDecks, "decks")}</li>
        <li>${limit(p.maxCards, "cards")}</li>
        <li>${limit(p.maxMembers, p.maxMembers === 1 ? "member" : "members")}</li>
        ${feats}
      </ul>
      <div class="cta"></div>`;
    const cta = card.querySelector(".cta");
    if (isCurrent) {
      cta.innerHTML = `<button class="ghost" disabled>Current plan</button>`;
    } else if (p.id === "free") {
      cta.innerHTML = `<button class="ghost" disabled>—</button>`;
    } else {
      const btn = document.createElement("button");
      btn.className = "primary";
      btn.textContent = `Upgrade to ${p.name}`;
      btn.addEventListener("click", () => startUpgrade(p.id, btn));
      cta.appendChild(btn);
    }
    host.appendChild(card);
  }
}

async function startUpgrade(plan, btn) {
  btn.disabled = true;
  btn.textContent = "Starting…";
  $("#pricing-msg").textContent = "";
  try {
    const r = await api.post("/api/billing/checkout", { plan });
    if (r.dev) {
      // No Stripe configured: the upgrade already applied — reflect it.
      $("#pricing-msg").textContent = "Upgraded (dev mode — no payment taken).";
      await loadWorkspaceInfo();
      loadPricing();
    } else if (r.url) {
      window.location.href = r.url; // off to Stripe Checkout
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = `Upgrade to ${plan}`;
    $("#pricing-msg").textContent = err.status === 403 ? "Only an admin can upgrade this workspace." : err.message;
  }
}

// ---- stats dashboard ----
$("#stats-refresh").addEventListener("click", loadStats);

async function loadStats() {
  let s;
  try { s = await api.get("/api/stats"); } catch { return; }

  const metrics = [
    { value: s.totalCards, label: "Cards in study" },
    { value: s.reviewedToday, label: "Reviewed today" },
    { value: s.retentionRate == null ? "—" : s.retentionRate, unit: s.retentionRate == null ? "" : "%", label: "Retention (14d)" },
    { value: s.streakDays, unit: s.streakDays === 1 ? "day" : "days", label: "Study streak" },
  ];
  $("#metric-row").innerHTML = metrics
    .map((m) => `<div class="metric"><div class="value">${m.value}${m.unit ? `<span class="unit">${m.unit}</span>` : ""}</div><div class="label">${m.label}</div></div>`)
    .join("");

  renderBars($("#chart-reviews"), s.daily.map((d) => ({ n: d.count, lbl: d.date.slice(5) })), "");
  renderBars($("#chart-forecast"), s.forecast.map((d) => ({ n: d.due, lbl: d.date.slice(5) })), "forecast");
}

function renderBars(host, points, cls) {
  const max = Math.max(1, ...points.map((p) => p.n));
  host.innerHTML = points
    .map((p) => {
      const h = p.n === 0 ? 2 : Math.round((p.n / max) * 100);
      return `<div class="bar-col">
        <div class="bar ${cls}" style="height:${h === 2 ? "2px" : h + "%"}">${p.n ? `<span class="n">${p.n}</span>` : ""}</div>
        <span class="lbl">${p.lbl}</span>
      </div>`;
    })
    .join("");
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

// ---- workspace bootstrap & switcher ----
$("#ws-btn").addEventListener("click", () => $("#ws-panel").classList.toggle("hidden"));
document.addEventListener("click", (e) => {
  if (!e.target.closest("#ws-panel") && !e.target.closest("#ws-btn")) $("#ws-panel").classList.add("hidden");
});
$("#ws-copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(wsKey); flash($("#ws-copy"), "Copied ✓"); }
  catch { $("#ws-key").select(); document.execCommand("copy"); flash($("#ws-copy"), "Copied ✓"); }
});
$("#ws-join").addEventListener("click", async () => {
  const key = $("#ws-join-key").value.trim();
  if (!key) return;
  $("#ws-msg").textContent = "";
  // Validate the key before switching to it.
  const r = await fetch("/api/workspace", { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) { $("#ws-msg").textContent = "That key isn't valid."; return; }
  const ws = await r.json();
  await rememberKey(key);
  setWorkspace(key, ws.name);
});
$("#ws-new").addEventListener("click", async () => {
  const ws = await (await fetch("/api/workspaces", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "New workspace" }),
  })).json();
  await rememberKey(ws.key);
  setWorkspace(ws.key, ws.name);
});

function setWorkspace(key, name) {
  wsKey = key;
  localStorage.setItem(WS_KEY, key);
  localStorage.setItem(WS_NAME, name || "Workspace");
  location.reload();
}

let wsRole = "admin";
let wsMemberId = null;

$("#ws-madd").addEventListener("click", async () => {
  const name = $("#ws-mname").value.trim();
  const role = $("#ws-mrole").value;
  $("#ws-msg").textContent = "";
  try {
    const m = await api.post("/api/members", { name, role });
    $("#ws-mname").value = "";
    $("#ws-newkey-val").value = m.key;
    $("#ws-newkey").classList.remove("hidden");
    loadMembers();
  } catch (err) { $("#ws-msg").textContent = err.message; }
});
$("#ws-newkey-copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#ws-newkey-val").value); flash($("#ws-newkey-copy"), "Copied ✓"); } catch {}
});

async function loadMembers() {
  let members;
  try { members = await api.get("/api/members"); } catch { return; }
  const ul = $("#ws-members");
  ul.innerHTML = "";
  for (const m of members) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${esc(m.name)}<span class="role">${m.role}</span>${m.id === wsMemberId ? " <span class='muted small'>(you)</span>" : ""}</span>`;
    if (m.id !== wsMemberId) {
      const btn = document.createElement("button");
      btn.className = "revoke";
      btn.title = "Revoke";
      btn.textContent = "✕";
      btn.addEventListener("click", async () => {
        $("#ws-msg").textContent = "";
        try { await api.del(`/api/members/${m.id}`); loadMembers(); }
        catch { $("#ws-msg").textContent = "Couldn't revoke (cannot remove the last admin)."; }
      });
      li.appendChild(btn);
    }
    ul.appendChild(li);
  }
}

// Returns true when the current key resolves to a workspace, false otherwise
// (e.g. a stale key left over from a previous database).
async function loadWorkspaceInfo() {
  try {
    const w = await api.get("/api/workspace");
    wsRole = w.role;
    wsMemberId = w.memberId;
    localStorage.setItem(WS_NAME, w.name);
    $("#ws-name").textContent = w.name;
    $("#ws-panel-name").textContent = w.name;
    $("#ws-role").textContent = w.role;
    $("#ws-key").value = wsKey;
    if (w.planInfo) {
      currentPlan = w.plan;
      $("#ws-plan").textContent = w.planInfo.name;
      const dl = w.planInfo.maxDecks == null ? "∞" : w.planInfo.maxDecks;
      const cl = w.planInfo.maxCards == null ? "∞" : w.planInfo.maxCards;
      $("#ws-usage").textContent = `${w.usage.decks}/${dl} decks · ${w.usage.cards}/${cl} cards · ${w.usage.members} member${w.usage.members === 1 ? "" : "s"}`;
      $("#ws-upgrade").classList.toggle("hidden", w.plan !== "free");
    }
    const isAdmin = w.role === "admin";
    $("#ws-admin").classList.toggle("hidden", !isAdmin);
    // Viewers see a read-only UI (the server enforces this regardless).
    document.body.classList.toggle("readonly", w.role === "viewer");
    if (isAdmin) loadMembers();
    return true;
  } catch {
    return false;
  }
}

async function createWorkspace(name = "My workspace") {
  const ws = await (await fetch("/api/workspaces", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
  })).json();
  wsKey = ws.key;
  localStorage.setItem(WS_KEY, ws.key);
  localStorage.setItem(WS_NAME, ws.name);
}

async function ensureWorkspace() {
  // Use the stored key only if it still resolves; otherwise (first visit or a
  // stale key from an old database) provision a fresh workspace.
  if (!wsKey || !(await loadWorkspaceInfo())) {
    await createWorkspace();
    await loadWorkspaceInfo();
  }
}

// ---- accounts ----
const acctJson = (url, opts = {}) =>
  fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...(sessionToken ? { "X-Session": sessionToken } : {}), ...(opts.headers || {}) } });

$("#acct-signup").addEventListener("click", () => authSubmit("/api/auth/signup"));
$("#acct-login").addEventListener("click", () => authSubmit("/api/auth/login"));
$("#acct-forgot").addEventListener("click", async () => {
  const email = $("#acct-email").value.trim() || prompt("Enter your account email:");
  if (!email) return;
  const r = await (await fetch("/api/auth/request-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })).json().catch(() => ({}));
  // Same message whether or not the account exists (no email enumeration).
  $("#acct-msg").style.color = "var(--muted)";
  $("#acct-msg").textContent = "If that email has an account, a reset link is on its way.";
  if (r.devLink) { $("#acct-msg").innerHTML += ` <a href="${r.devLink}">Open reset link (dev)</a>`; }
});
$("#acct-logout").addEventListener("click", async () => {
  await acctJson("/api/auth/logout", { method: "POST" }).catch(() => {});
  sessionToken = "";
  localStorage.removeItem(SESSION);
  renderSignedOut();
});

async function authSubmit(url) {
  $("#acct-msg").textContent = "";
  const email = $("#acct-email").value.trim();
  const password = $("#acct-pass").value;
  const r = await acctJson(url, { method: "POST", body: JSON.stringify({ email, password }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { $("#acct-msg").textContent = data.error || "Could not authenticate."; return; }
  sessionToken = data.token;
  localStorage.setItem(SESSION, data.token);
  // Land in a workspace from the account: the new one (signup) or the first key.
  const key = data.key || data.account?.keychain?.[0]?.memberKey;
  if (key) { wsKey = key; localStorage.setItem(WS_KEY, key); }
  location.reload();
}

async function loadAccount() {
  if (!sessionToken) return renderSignedOut();
  const r = await acctJson("/api/account");
  if (!r.ok) { sessionToken = ""; localStorage.removeItem(SESSION); return renderSignedOut(); }
  renderSignedIn(await r.json());
}
function renderSignedOut() {
  $("#acct-out").classList.remove("hidden");
  $("#acct-in").classList.add("hidden");
}
function renderSignedIn(account) {
  $("#acct-out").classList.add("hidden");
  $("#acct-in").classList.remove("hidden");
  $("#acct-who").textContent = account.email;
  const ul = $("#acct-keychain");
  ul.innerHTML = "";
  for (const k of account.keychain) {
    const li = document.createElement("li");
    const current = k.memberKey === wsKey;
    li.innerHTML = `<span>${esc(k.workspaceName)}<span class="role">${k.role}</span>${current ? " <span class='muted small'>(current)</span>" : ""}</span>`;
    if (!current) {
      const btn = document.createElement("button");
      btn.className = "ghost small";
      btn.textContent = "Open";
      btn.addEventListener("click", () => setWorkspace(k.memberKey, k.workspaceName));
      li.appendChild(btn);
    }
    ul.appendChild(li);
  }
}
// When signed in, persist a workspace key to the account so it appears next login.
async function rememberKey(key) {
  if (!sessionToken) return;
  await acctJson("/api/account/keys", { method: "POST", body: JSON.stringify({ memberKey: key }) }).catch(() => {});
}

(async function start() {
  await ensureWorkspace();
  await loadAccount();
  loadDecks();
})();
