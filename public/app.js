// EchoDeck client.
import { onboardingSteps, onboardingProgress, nextStep } from "./onboarding.js";
import { parseYouTubeRef, createYouTubeLoop, embedUrl } from "./yt-player.js";
import { bcp47, isoOf, nameOf } from "./lang.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// --- workspace auth ---
const WS_KEY = "echodeck_ws_key";
const WS_NAME = "echodeck_ws_name";
const SESSION = "echodeck_session";
let wsKey = localStorage.getItem(WS_KEY) || "";
let sessionToken = localStorage.getItem(SESSION) || "";

// --- getting-started onboarding ---
// Client-side activation flags (reviewed / shadowed can't be inferred from the
// deck list) plus a dismissal flag, all kept per-browser in localStorage.
const OB_FLAGS = "echodeck_ob_flags";
const OB_DISMISSED = "echodeck_ob_dismissed";
const obFlags = () => { try { return JSON.parse(localStorage.getItem(OB_FLAGS)) || {}; } catch { return {}; } };
function markOnboarding(flag) {
  const f = obFlags();
  if (f[flag]) return;
  f[flag] = true;
  localStorage.setItem(OB_FLAGS, JSON.stringify(f));
  renderOnboarding();
}
let lastDecks = [];
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

const state = { deck: null, player: $("#player"), ytLoop: null };

// A tiny sample deck for the "try without signup" flow (?sample=1 from the
// landing page). Timestamped lines so cards show timecodes; no audio needed.
const SAMPLE_DECK = {
  title: "Sample — Japanese phrases",
  language: "Japanese",
  transcript: [
    "[00:00] 今日は天気がいいです。",
    "[00:04] 週末は雨が降るかもしれません。",
    "[00:09] 電車が少し遅れています。",
    "[00:13] コーヒーを一杯ください。",
    "[00:17] この本はとても面白いです。",
  ].join("\n"),
};

// ---- view switching ----
$$(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.classList.toggle("is-active", x === t));
    $$(".view").forEach((v) => v.classList.toggle("is-active", v.id === `view-${t.dataset.view}`));
    if (t.dataset.view === "alerts") loadAlerts();
    if (t.dataset.view === "stats") loadStats();
    if (t.dataset.view === "discover") loadMarketplace();
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

// ---- auto-transcription (audio URL → timestamped transcript) ----
$("#transcribeBtn").addEventListener("click", async () => {
  const url = $("#audioUrl").value.trim();
  const status = $("#uploadStatus");
  if (!url) { status.textContent = "Add an audio URL (or upload a file) to transcribe."; return; }
  const btn = $("#transcribeBtn");
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "Transcribing…";
  status.textContent = "Transcribing audio — this can take a moment…";
  try {
    const res = await api.post("/api/transcribe", { audioUrl: url });
    const ta = $("#build-form").transcript;
    ta.value = ta.value.trim() ? ta.value.trimEnd() + "\n\n" + res.transcript : res.transcript;
    const n = res.segments?.length;
    status.textContent = n ? `Transcribed ${n} segment${n === 1 ? "" : "s"}.` : "Transcript added.";
  } catch (err) {
    status.textContent = err.message;
  } finally {
    btn.textContent = old;
    btn.disabled = false;
  }
});

// Show the attached YouTube video right in the build form so "is the video
// attached?" is visible at a glance (a youtube:<id> string alone isn't).
function updateAudioPreview() {
  const host = $("#audio-preview");
  const id = parseYouTubeRef($("#audioUrl").value.trim());
  if (!id) { host.classList.add("hidden"); host.textContent = ""; return; }
  const src = embedUrl(id);
  if (host.firstChild?.src !== src) {
    host.textContent = "";
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = "Attached video preview";
    iframe.allowFullscreen = true;
    host.appendChild(iframe);
  }
  host.classList.remove("hidden");
}
$("#audioUrl").addEventListener("input", updateAudioPreview);

// ---- URL / YouTube import (captions → transcript) ----
// `lang` forces a caption language (from a chip click); `replace` swaps the
// transcript instead of appending (re-importing the same video in another
// language shouldn't stack two transcripts).
async function runImport({ lang, replace = false } = {}) {
  const f = $("#build-form");
  const url = $("#import-url").value.trim();
  const status = $("#import-status");
  if (!url) { status.textContent = "Paste a YouTube link or a subtitle URL to import."; return; }
  const btn = $("#import-btn");
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "Importing…";
  status.textContent = "Fetching captions — this can take a moment…";
  $("#import-langs").textContent = "";
  try {
    // The Language field takes names ("English"); caption APIs take ISO codes.
    const wantedLang = lang ?? isoOf(f.language.value);
    const res = await api.post("/api/import", { url, lang: wantedLang });
    const ta = f.transcript;
    ta.value = replace || !ta.value.trim() ? res.transcript : ta.value.trimEnd() + "\n\n" + res.transcript;
    if (res.title && !f.title.value.trim()) f.title.value = res.title;
    const gotLang = isoOf(res.language);
    if (res.language && (replace || !f.language.value.trim())) f.language.value = nameOf(res.language);
    // Attach the video so shadowing loops play the real YouTube segments.
    if (res.videoId && !f.audioUrl.value.trim()) f.audioUrl.value = `youtube:${res.videoId}`;
    let msg = `Imported ${res.segmentCount} line${res.segmentCount === 1 ? "" : "s"}`;
    if (gotLang) msg += ` in ${nameOf(gotLang)}`;
    if (res.videoId) msg += ` + attached the video (it appears when you build the deck)`;
    msg += " — review, then Build deck.";
    if (gotLang && wantedLang && gotLang !== wantedLang) {
      msg += ` ⚠ You asked for ${nameOf(wantedLang)} but only ${nameOf(gotLang)} captions were available.`;
    }
    // One-click switches for the video's other caption languages. The default
    // track isn't always the spoken language (e.g. creator-uploaded subs).
    const others = [...new Set((res.availableLangs || []).map((l) => isoOf(l) || l))].filter((l) => l && l !== gotLang);
    if (others.length) {
      const chips = $("#import-langs");
      const label = document.createElement("span");
      label.className = "muted small";
      label.textContent = "Also available — click to use instead:";
      chips.appendChild(label);
      for (const l of others.slice(0, 8)) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "lang-chip";
        b.textContent = nameOf(l);
        b.addEventListener("click", () => runImport({ lang: l, replace: true }));
        chips.appendChild(b);
      }
    } else if (gotLang && !wantedLang) {
      msg += ` Wrong language? Type e.g. "English" in Language, clear the transcript, and press Import again.`;
    }
    status.textContent = msg;
    updateAudioPreview();
  } catch (err) {
    status.textContent = err.message;
  } finally {
    btn.textContent = old;
    btn.disabled = false;
  }
}
$("#import-btn").addEventListener("click", () => runImport());

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
    $("#import-status").textContent = "";
    $("#import-langs").textContent = "";
    updateAudioPreview();
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
  lastDecks = decks;
  renderOnboarding();
  const ul = $("#deck-list");
  ul.innerHTML = "";
  if (!decks.length) {
    const li = document.createElement("li");
    li.className = "deck-empty";
    li.innerHTML = `
      <p>No decks yet. Build one from a transcript on the left — or start with a ready-made sample.</p>
      <div class="row"><button id="empty-sample" class="primary small">Load a sample deck</button></div>`;
    ul.appendChild(li);
    $("#empty-sample").addEventListener("click", buildSample);
    return;
  }
  for (const d of decks) {
    const li = document.createElement("li");
    li.className = "deck-item";
    li.innerHTML = `
      <div>
        <div class="title">${esc(d.title)}</div>
        <div class="sub">${esc(d.language || "—")} · ${d.cardCount} cards
          ${d.dueCount ? `· <span class="pill">${d.dueCount} due</span>` : ""}
          ${d.shareId ? `· 👁 ${d.views || 0} · ⬇ ${d.installs || 0}${d.listed ? " · listed" : ""}` : ""}</div>
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
  refreshCreatorSummary();
}

// Creator analytics summary above the deck list — total reach of shared decks.
// Gated behind sharing server-side; silently hidden for plans without it.
async function refreshCreatorSummary() {
  const el = $("#creator-summary");
  let s;
  try { s = await api.get("/api/creator/stats"); } catch { el.classList.add("hidden"); return; }
  if (!s || s.sharedCount === 0) { el.classList.add("hidden"); return; }
  el.innerHTML = `📣 <strong>${s.sharedCount}</strong> shared${s.listedCount ? ` (${s.listedCount} listed)` : ""} · 👁 <strong>${s.totalViews}</strong> view${s.totalViews === 1 ? "" : "s"} · ⬇ <strong>${s.totalInstalls}</strong> install${s.totalInstalls === 1 ? "" : "s"}`;
  el.classList.remove("hidden");
}

// Render the "getting started" checklist. Hidden once every step is done or the
// learner dismisses it; steps derive from the deck list plus activation flags.
// Each step's action jumps the user straight to the relevant place in the app.
const OB_ACTIONS = {
  build: { text: "Start", run: () => { goTo("build"); $("#build-form")?.title?.focus(); } },
  review: { text: "Open a deck", run: () => { goTo("build"); if (lastDecks[0]) openDeck(lastDecks[0].id); } },
  shadow: { text: "How", run: () => { goTo("build"); if (lastDecks[0]) openDeck(lastDecks[0].id); } },
  share: { text: "Open a deck", run: () => { goTo("build"); if (lastDecks[0]) openDeck(lastDecks[0].id); } },
};
function renderOnboarding() {
  const host = $("#onboarding");
  if (!host) return;
  if (localStorage.getItem(OB_DISMISSED)) { host.classList.add("hidden"); return; }
  const steps = onboardingSteps({ decks: lastDecks, flags: obFlags() });
  const prog = onboardingProgress(steps);
  if (prog.complete) { host.classList.add("hidden"); return; }
  const next = nextStep(steps);
  host.innerHTML = `
    <div class="ob-head">
      <h2>Get started with EchoDeck</h2>
      <button class="ob-dismiss" type="button">Dismiss</button>
    </div>
    <p class="ob-sub">${prog.done} of ${prog.total} done — a few minutes to your first study session.</p>
    <div class="ob-bar"><i style="width:${prog.percent}%"></i></div>
    <ol class="ob-steps"></ol>`;
  const ol = $("ol.ob-steps", host);
  for (const s of steps) {
    const li = document.createElement("li");
    li.className = "ob-step" + (s.done ? " done" : (next && s.id === next.id ? " next" : ""));
    li.innerHTML = `
      <span class="tick">${s.done ? "✓" : ""}</span>
      <span class="ob-text"><span class="ob-label">${esc(s.label)}</span><span class="ob-hint"> — ${esc(s.hint)}</span></span>`;
    if (!s.done && OB_ACTIONS[s.id]) {
      const go = document.createElement("button");
      go.type = "button";
      go.className = "ob-go";
      go.textContent = OB_ACTIONS[s.id].text;
      go.addEventListener("click", OB_ACTIONS[s.id].run);
      li.appendChild(go);
    }
    ol.appendChild(li);
  }
  $(".ob-dismiss", host).addEventListener("click", () => { localStorage.setItem(OB_DISMISSED, "1"); host.classList.add("hidden"); });
  host.classList.remove("hidden");
}

// Switch to a top-level tab programmatically (used by onboarding actions).
function goTo(view) {
  const tab = $$(".tab").find((t) => t.dataset.view === view);
  if (tab) tab.click();
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
  const ytId = parseYouTubeRef(d.audioUrl);
  $("#study-meta").textContent = `${esc(d.language || "—")} · ${d.cards.length} cards · ${ytId ? "video attached" : d.audioUrl ? "audio attached" : "no audio"}`;
  $("#due-badge").textContent = dueCount;
  // Playback source: a YouTube deck mounts the embedded player (loops drive the
  // real video); anything else uses the plain <audio> element.
  const dock = $("#yt-dock");
  if (ytId) {
    if (state.ytLoop?.videoId !== ytId) {
      state.ytLoop?.destroy();
      state.ytLoop = createYouTubeLoop({ container: dock, videoId: ytId });
    }
    dock.classList.remove("hidden");
  } else {
    state.ytLoop?.destroy();
    state.ytLoop = null;
    dock.classList.add("hidden");
    if (d.audioUrl) state.player.src = d.audioUrl;
  }

  if (d.shareId) showShareBar(`${location.origin}/s/${d.shareId}`);
  else $("#share-bar").classList.add("hidden");
  renderListBar();
  $("#ai-fill-btn").classList.toggle("hidden", !enrichConfigured);

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
    <div class="card-notes ${card.notes ? "" : "hidden"}">${esc(card.notes || "")}</div>
    <div class="tools">
      ${hasAudio ? '<button class="play">▶ Shadow loop</button>' : ""}
      <button class="save ghost">Save back</button>
      ${enrichConfigured ? '<button class="ai ghost" title="Fill translation + notes with AI">✨ AI fill</button>' : ""}
    </div>`;
  const backInput = $(".back-input", el);
  const notesEl = $(".card-notes", el);
  $(".save", el).addEventListener("click", async () => {
    const updated = await api.patch(`/api/cards/${card.id}`, { back: backInput.value });
    card.back = updated.back;
    flash($(".save", el), "Saved ✓");
  });
  const aiBtn = $(".ai", el);
  if (aiBtn) aiBtn.addEventListener("click", async () => {
    aiBtn.disabled = true;
    const old = aiBtn.textContent;
    aiBtn.textContent = "Thinking…";
    try {
      const res = await api.post(`/api/cards/${card.id}/enrich`, { overwrite: true });
      card.back = res.card.back;
      card.notes = res.card.notes;
      backInput.value = card.back || "";
      notesEl.textContent = card.notes || "";
      notesEl.classList.toggle("hidden", !card.notes);
      aiBtn.textContent = old;
      flash(aiBtn, "Filled ✓");
    } catch (err) {
      aiBtn.textContent = old;
      if (err.upgrade) { showView("pricing"); loadPricing(); }
      else alert(err.message);
    } finally {
      aiBtn.disabled = false;
    }
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
  // YouTube deck: drive the embedded player instead of the <audio> element.
  if (state.ytLoop) {
    if (loopStop) loopStop();
    state.ytLoop.playLoop(start, end, speed);
    loopStop = () => { state.ytLoop?.stop(); loopStop = null; };
    return;
  }
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

// ---- AI-fill empty backs (whole deck) ----
$("#ai-fill-btn").addEventListener("click", async () => {
  if (!state.deck) return;
  const btn = $("#ai-fill-btn");
  const empty = state.deck.cards.filter((c) => !c.back).length;
  if (!empty) { flash(btn, "All filled"); return; }
  if (!confirm(`Use AI to fill ${empty} empty card back${empty === 1 ? "" : "s"} in this deck?`)) return;
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "Filling…";
  try {
    const res = await api.post(`/api/decks/${state.deck.id}/enrich`, {});
    state.deck = res.deck;
    renderDeck();
    flash($("#ai-fill-btn"), `Filled ${res.updated}`);
  } catch (err) {
    btn.textContent = old;
    if (err.upgrade) { showView("pricing"); loadPricing(); }
    else alert(err.message);
  } finally {
    btn.disabled = false;
  }
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

// ---- marketplace: listing the current deck ----
$("#list-btn").addEventListener("click", () => {
  $("#mkt-bar").classList.toggle("hidden");
});
$("#mkt-list").addEventListener("click", async () => {
  if (!state.deck) return;
  try {
    const res = await api.post(`/api/decks/${state.deck.id}/list`, { description: $("#mkt-desc").value.trim() });
    state.deck.listed = true;
    state.deck.shareId = res.shareId;
    state.deck.description = res.description;
    showShareBar(`${location.origin}/s/${res.shareId}`);
    renderListBar();
    flash($("#mkt-list"), "Published ✓");
  } catch (err) { showBuildError(err); }
});
$("#mkt-unlist").addEventListener("click", async () => {
  if (!state.deck) return;
  await api.del(`/api/decks/${state.deck.id}/list`);
  state.deck.listed = false;
  renderListBar();
});

function renderListBar() {
  const d = state.deck;
  const listed = Boolean(d?.listed);
  $("#list-btn").textContent = listed ? "Listed ✓" : "List";
  $("#mkt-desc").value = d?.description || "";
  $("#mkt-list").textContent = listed ? "Update" : "Publish";
  $("#mkt-unlist").classList.toggle("hidden", !listed);
  const installs = $("#mkt-installs");
  if (listed && d.installs) {
    installs.textContent = `· ${d.installs} install${d.installs === 1 ? "" : "s"}`;
    installs.classList.remove("hidden");
  } else {
    installs.classList.add("hidden");
  }
  $("#mkt-bar-label").textContent = listed ? "Live on the marketplace:" : "List on the marketplace:";
}

// ---- discover (browse & install marketplace decks) ----
let discoverAll = [];
let discoverTimer = null;
$("#disc-q").addEventListener("input", () => { clearTimeout(discoverTimer); discoverTimer = setTimeout(renderDiscover, 150); });
$("#disc-lang").addEventListener("change", renderDiscover);

async function loadMarketplace() {
  const status = $("#disc-status");
  status.style.display = "block";
  status.textContent = "Loading decks…";
  try {
    discoverAll = await api.get("/api/marketplace?limit=200");
  } catch { status.textContent = "Couldn't load the marketplace."; return; }
  const sel = $("#disc-lang");
  const chosen = sel.value;
  const langs = [...new Set(discoverAll.map((d) => d.language).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">All languages</option>` + langs.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
  sel.value = langs.includes(chosen) ? chosen : "";
  renderDiscover();
}

function renderDiscover() {
  const q = $("#disc-q").value.trim().toLowerCase();
  const lang = $("#disc-lang").value;
  const list = discoverAll.filter((d) =>
    (!lang || (d.language || "") === lang) &&
    (!q || `${d.title} ${d.description || ""} ${d.language || ""}`.toLowerCase().includes(q)));
  const grid = $("#disc-grid");
  const status = $("#disc-status");
  grid.innerHTML = "";
  if (!list.length) {
    status.style.display = "block";
    status.textContent = discoverAll.length ? "No decks match your search." : "No decks published yet — list one of yours to seed it.";
    return;
  }
  status.style.display = "none";
  for (const d of list) {
    const el = document.createElement("div");
    el.className = "mkt-card";
    el.innerHTML = `
      <h3>${esc(d.title)}</h3>
      <div class="creator">by ${esc(d.creator)}</div>
      <div class="desc">${esc(d.description || "No description provided.")}</div>
      <div class="mkt-meta">
        <span class="deck-chip">${esc(d.language || "—")}</span>
        <span class="pill">${d.cardCount} cards</span>
        ${d.installs ? `<span class="pill">${d.installs} install${d.installs === 1 ? "" : "s"}</span>` : ""}
      </div>
      <div class="cta">
        <button class="primary install">Add to my decks</button>
        <a class="ghost" style="text-decoration:none" href="/s/${encodeURIComponent(d.shareId)}" target="_blank" rel="noopener">Preview ↗</a>
      </div>`;
    const btn = $(".install", el);
    btn.addEventListener("click", () => installListing(d.shareId, btn));
    grid.appendChild(el);
  }
}

async function installListing(shareId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Adding…"; }
  try {
    const res = await api.post(`/api/marketplace/${encodeURIComponent(shareId)}/install`, {});
    await loadDecks();
    await openDeck(res.deckId);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "Add to my decks"; }
    if (err.upgrade) { showView("pricing"); loadPricing(); }
    else alert(err.message);
  }
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

// ---- pronunciation scoring (record yourself shadowing) ----
// Uses the browser's Web Speech API for on-device transcription (no server
// key), then scores it with /api/cards/:id/pronounce. Progressive enhancement:
// if the browser lacks SpeechRecognition, the button is hidden.
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null, recording = false;

const recBtn = $("#rev-record");
if (!SpeechRec) recBtn.style.display = "none";
recBtn.addEventListener("click", () => {
  if (!SpeechRec) return;
  if (recording) { recognizer?.stop(); return; }
  const c = review.queue[review.idx];
  if (!c) return;
  recognizer = new SpeechRec();
  const lang = bcp47(state.deck?.language);
  if (lang) recognizer.lang = lang;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  recording = true;
  recBtn.classList.add("recording");
  recBtn.textContent = "■ Stop";
  const host = $("#pronounce-result");
  host.innerHTML = `<span class="pron-listening">● Listening — say the phrase now…</span>`;
  host.classList.remove("hidden");
  recognizer.onresult = (e) => scorePronunciation(c, e.results[0][0].transcript);
  recognizer.onerror = (e) => {
    host.innerHTML = `<span class="muted small">${e.error === "no-speech" ? "Didn't catch that — try again." : "Microphone/recognition error: " + esc(e.error)}</span>`;
  };
  recognizer.onend = () => { recording = false; recBtn.classList.remove("recording"); recBtn.textContent = "🎤 Shadow & score"; };
  try { recognizer.start(); } catch { recognizer.onend(); }
});

async function scorePronunciation(card, heard) {
  let res;
  try { res = await api.post(`/api/cards/${card.id}/pronounce`, { heard }); }
  catch { return; }
  markOnboarding("shadowed");
  const host = $("#pronounce-result");
  const words = res.words.map((w) => `<span class="w ${w.ok ? "ok" : "miss"}">${esc(w.token)}</span>`).join(" ");
  host.innerHTML = `
    <div><span class="pron-score">${res.score}<span class="unit">%</span></span><span class="pron-grade">suggested: ${res.suggestedGrade}</span></div>
    <div class="pron-words">${words || '<span class="muted small">(no target words)</span>'}</div>
    <div class="pron-heard">You said: “${esc(heard)}”</div>`;
  host.classList.remove("hidden");
  // Reveal the answer and nudge the grade button that matches the score.
  if ($("#grade-buttons").classList.contains("hidden")) showAnswer();
  $$("#grade-buttons button").forEach((b) => b.classList.toggle("suggested", b.dataset.grade === res.suggestedGrade));
}

function resetPronounce() {
  if (recording) { try { recognizer?.stop(); } catch {} }
  $("#pronounce-result").classList.add("hidden");
  $("#pronounce-result").innerHTML = "";
  $$("#grade-buttons button").forEach((b) => b.classList.remove("suggested"));
}
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
  // Shadowing controls: the loop needs audio+timing, but record-and-score works
  // for any card, so show the panel whenever recognition is available.
  $("#review-shadow").classList.toggle("hidden", !(state.deck.audioUrl && c.start != null) && !SpeechRec);
  $("#rev-play").classList.toggle("hidden", !(state.deck.audioUrl && c.start != null));
  resetPronounce();
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
  markOnboarding("reviewed");
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
let billingInterval = "month";
let lastPlans = null;

$("#bill-month").addEventListener("click", () => setBillingInterval("month"));
$("#bill-year").addEventListener("click", () => setBillingInterval("year"));
function setBillingInterval(interval) {
  billingInterval = interval;
  $("#bill-month").classList.toggle("is-active", interval === "month");
  $("#bill-year").classList.toggle("is-active", interval === "year");
  if (lastPlans) renderPricingCards(lastPlans);
}

async function loadPricing() {
  let plans, ws;
  try { [plans, ws] = await Promise.all([api.get("/api/plans"), api.get("/api/workspace")]); } catch { return; }
  currentPlan = ws.plan;
  lastPlans = plans;
  // Only offer the annual toggle when the server can actually honour it.
  const annualOn = ws.annualBilling && plans.some((p) => p.priceYear);
  $(".billing-toggle").classList.toggle("hidden", !annualOn);
  if (!annualOn && billingInterval === "year") setBillingInterval("month");
  // Surface the best annual saving on the toggle badge.
  const bestSave = Math.max(0, ...plans.map((p) => p.yearSavingPct || 0));
  $("#bill-save").textContent = bestSave ? `save ${bestSave}%` : "";
  $("#pricing-current").textContent = `You're on the ${ws.planInfo.name} plan · ${ws.usage.decks} decks · ${ws.usage.cards} cards`;
  $("#manage-btn").classList.toggle("hidden", ws.plan === "free");
  $("#pricing-msg").textContent = "";
  renderPricingCards(plans);
}

const PRICE_FEAT = { sharing: "Public deck sharing", reminders: "Review reminders", stats: "Study dashboard", enrich: "AI card-back fill" };
function renderPricingCards(plans) {
  const annual = billingInterval === "year";
  const host = $("#pricing-cards");
  host.innerHTML = "";
  for (const p of plans) {
    const isCurrent = p.id === currentPlan;
    const card = document.createElement("div");
    card.className = `plan-card${isCurrent ? " current" : ""}${p.id === "pro" ? " featured" : ""}`;
    const limit = (v, unit) => (v === null ? `Unlimited ${unit}` : `${v} ${unit}`);
    const feats = Object.keys(PRICE_FEAT)
      .map((f) => `<li class="${p.features[f] ? "" : "off"}">${PRICE_FEAT[f]}</li>`)
      .join("");
    // Price block: free is always free; paid plans show the selected interval,
    // with an effective monthly figure + saving when annual is chosen.
    let priceHtml;
    if (p.price === 0) {
      priceHtml = `<div class="price">Free<span></span></div>`;
    } else if (annual && p.priceYear) {
      const perMo = (p.priceYear / 12).toFixed(2).replace(/\.00$/, "");
      priceHtml = `<div class="price">$${perMo}<span>/mo</span></div>
        <div class="price-sub">$${p.priceYear} billed yearly${p.yearSavingPct ? ` · save ${p.yearSavingPct}%` : ""}</div>`;
    } else {
      priceHtml = `<div class="price">$${p.price}<span>/mo</span></div>
        ${p.priceYear ? `<div class="price-sub">or $${p.priceYear}/yr</div>` : ""}`;
    }
    card.innerHTML = `
      ${p.id === "pro" ? '<span class="plan-badge">Most popular</span>' : ""}
      <h3>${p.name}</h3>
      ${priceHtml}
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
    const r = await api.post("/api/billing/checkout", { plan, interval: billingInterval });
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
let enrichConfigured = false;
let transcribeConfigured = false;

$("#ws-madd").addEventListener("click", async () => {
  const name = $("#ws-mname").value.trim();
  const role = $("#ws-mrole").value;
  const email = $("#ws-memail").value.trim();
  $("#ws-msg").textContent = "";
  try {
    const m = await api.post("/api/members", { name, role, email: email || undefined });
    $("#ws-mname").value = "";
    $("#ws-memail").value = "";
    $("#ws-newkey-val").value = m.inviteLink || m.key;
    $("#ws-newkey-label").textContent = m.invited
      ? `✓ Invitation emailed to ${m.inviteEmail}. Their join link (also copy-able):`
      : m.inviteLink
        ? "Share this one-click join link (carries their access key):"
        : "New member key (copy now — shown once):";
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
    enrichConfigured = Boolean(w.enrichConfigured);
    transcribeConfigured = Boolean(w.transcribeConfigured);
    $("#transcribeBtn").classList.toggle("hidden", !transcribeConfigured);
    $("#import-row").classList.toggle("hidden", !w.importConfigured);
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
  // Signing out must also drop workspace access on this device: the member key
  // grants full data access without a password, so leaving it behind would let
  // the next person on this browser read every deck. Logging back in restores
  // the keys from the account's keychain.
  wsKey = "";
  localStorage.removeItem(WS_KEY);
  localStorage.removeItem(WS_NAME);
  location.reload();
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

// ---- push notifications (installed PWA) ----
function urlB64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
let pushPublicKey = null;

function reflectPush(on) {
  $("#push-enable").textContent = on ? "🔔 Notifications on" : "🔔 Enable notifications on this device";
  $("#push-enable").disabled = on;
  $("#push-test").classList.toggle("hidden", !on);
}

async function initPush() {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  let cfg;
  try { cfg = await api.get("/api/push/config"); } catch { cfg = { enabled: false }; }
  if (!supported || !cfg.enabled) { $("#push-row").classList.add("hidden"); return; }
  pushPublicKey = cfg.publicKey;
  $("#push-row").classList.remove("hidden");
  try {
    const reg = await navigator.serviceWorker.ready;
    reflectPush(Boolean(await reg.pushManager.getSubscription()));
  } catch { reflectPush(false); }
}

$("#push-enable").addEventListener("click", async () => {
  const status = $("#push-status");
  try {
    if (await Notification.requestPermission() !== "granted") { status.textContent = "Notifications permission was denied."; return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(pushPublicKey) });
    await api.post("/api/push/subscribe", { subscription: sub });
    reflectPush(true);
    status.textContent = "Device notifications enabled — you'll get a nudge when cards are due.";
  } catch (err) { status.textContent = "Couldn't enable notifications: " + err.message; }
});

$("#push-test").addEventListener("click", async () => {
  const status = $("#push-status");
  try { const r = await api.post("/api/push/test", {}); status.textContent = `Sent to ${r.pushed} device${r.pushed === 1 ? "" : "s"}.`; }
  catch (err) { status.textContent = err.message; }
});

(async function start() {
  if ("serviceWorker" in navigator) { try { await navigator.serviceWorker.register("/sw.js"); } catch {} }
  const params = new URLSearchParams(location.search);
  // Invitation link: ?key=<memberKey> joins that workspace directly. Handled
  // before ensureWorkspace so an invitee lands in the workspace they were
  // invited to rather than a fresh anonymous one.
  const inviteKey = params.get("key");
  if (inviteKey) {
    try {
      const r = await fetch("/api/workspace", { headers: { Authorization: `Bearer ${inviteKey}` } });
      if (r.ok) {
        const ws = await r.json();
        wsKey = inviteKey;
        localStorage.setItem(WS_KEY, inviteKey);
        localStorage.setItem(WS_NAME, ws.name);
        await rememberKey(inviteKey);
      }
    } catch {}
    history.replaceState(null, "", location.pathname); // don't leave the key in the URL
  }
  await ensureWorkspace();
  await loadAccount();
  await loadDecks();
  initPush();
  // Deep links from the marketing site:
  //  ?install=<shareId> — install a marketplace deck into this workspace.
  //  ?sample=1          — build a ready-made sample deck (no signup needed).
  if (params.get("install")) {
    history.replaceState(null, "", location.pathname);
    await installListing(params.get("install"), null);
  } else if (params.get("sample")) {
    history.replaceState(null, "", location.pathname);
    await buildSample();
  }
})();

async function buildSample() {
  const f = $("#build-form");
  f.title.value = SAMPLE_DECK.title;
  f.language.value = SAMPLE_DECK.language;
  f.transcript.value = SAMPLE_DECK.transcript;
  try {
    const deck = await api.post("/api/decks", { ...SAMPLE_DECK, maxChars: 180 });
    f.reset();
    f.maxChars.value = 180;
    await loadDecks();
    openDeck(deck.id);
  } catch (err) {
    showBuildError(err);
  }
}
