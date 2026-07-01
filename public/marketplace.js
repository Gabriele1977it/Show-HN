// Public marketplace browse page.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const grid = $("#mkt-grid");
const status = $("#mkt-status");
let all = [];

function render(list) {
  grid.innerHTML = "";
  if (!list.length) {
    status.textContent = all.length ? "No decks match your search." : "No decks have been published yet. Be the first!";
    status.style.display = "block";
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
        <a class="primary" style="text-decoration:none;text-align:center" href="/app?install=${encodeURIComponent(d.shareId)}">Add to my decks</a>
        <a class="ghost" style="text-decoration:none" href="/s/${encodeURIComponent(d.shareId)}" target="_blank" rel="noopener">Preview ↗</a>
      </div>`;
    grid.appendChild(el);
  }
}

function applyFilters() {
  const q = $("#mkt-q").value.trim().toLowerCase();
  const lang = $("#mkt-lang").value;
  render(all.filter((d) =>
    (!lang || (d.language || "") === lang) &&
    (!q || `${d.title} ${d.description || ""} ${d.language || ""}`.toLowerCase().includes(q))));
}

async function load() {
  try {
    const r = await fetch("/api/marketplace?limit=200");
    all = await r.json();
  } catch { status.textContent = "Couldn't load the marketplace."; return; }
  const langs = [...new Set(all.map((d) => d.language).filter(Boolean))].sort();
  for (const l of langs) {
    const opt = document.createElement("option");
    opt.value = l; opt.textContent = l;
    $("#mkt-lang").appendChild(opt);
  }
  render(all);
}

$("#mkt-q").addEventListener("input", applyFilters);
$("#mkt-lang").addEventListener("change", applyFilters);
load();
