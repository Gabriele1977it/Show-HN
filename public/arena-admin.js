// Agent Arena — owner admin dashboard.
// Reuses the account session created on the arena page (same account system as
// EchoDeck). The server enforces OWNER_EMAILS; this just renders the data.

const session = localStorage.getItem("arena-session") || localStorage.getItem("echodeck_session") || "";
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (cents) => "$" + (Math.max(0, cents || 0) / 100).toFixed(2);
const when = (ts) => new Date(ts).toLocaleString();

function tile(label, value, sub = "") {
  return `<div class="metric"><div class="value">${esc(value)}</div><div class="label">${esc(label)}${sub ? ` · ${esc(sub)}` : ""}</div></div>`;
}

async function load() {
  let data;
  try {
    const r = await fetch("/api/arena/admin/stats", { headers: { "X-Session": session } });
    if (r.status === 403 || r.status === 401) { $("#gate").classList.remove("hidden"); $("#dash").classList.add("hidden"); return; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    data = await r.json();
  } catch (e) {
    $("#gate").classList.remove("hidden");
    $("#gate").querySelector("p").textContent = "Couldn't load the dashboard. Are you signed in as an owner?";
    return;
  }

  $("#gate").classList.add("hidden");
  $("#dash").classList.remove("hidden");
  $("#stamp").textContent = "as of " + new Date().toLocaleTimeString();

  const planMix = (data.accounts || []).reduce((m, a) => { m[a.plan || "free"] = (m[a.plan || "free"] || 0) + 1; return m; }, {});
  const paid = (data.accounts || []).filter((a) => a.plan && a.plan !== "free").length;
  const mixStr = Object.entries(planMix).map(([p, n]) => `${n} ${p}`).join(" · ");
  $("#tiles").innerHTML = [
    tile("accounts", data.totalAccounts, mixStr),
    tile("paid accounts", paid),
    tile("credits loaded", money(data.totalTopupCents)),
    tile("spent on runs", money(data.totalSpentCents), `${data.totalRuns} runs`),
  ].join("");

  const planPill = (p) => `<span class="kind-pill ${p === "free" ? "" : "topup"}">${esc(p || "free")}</span>`;
  $("#accounts-table tbody").innerHTML = (data.accounts || []).map((a) => `
    <tr>
      <td>${esc(a.email)}</td>
      <td>${planPill(a.plan)}</td>
      <td class="num">${money(a.credits)}</td>
      <td class="num">${money(a.topupCents)}</td>
      <td class="num">${money(a.spentCents)}</td>
      <td class="num">${a.runs}</td>
    </tr>`).join("") || `<tr><td colspan="6" class="muted">No accounts yet.</td></tr>`;

  $("#ledger-table tbody").innerHTML = (data.recent || []).map((e) => {
    const detail = e.kind === "run"
      ? `${(e.meta?.models || []).length} model(s)${e.meta?.tokens ? ` · ${e.meta.tokens} tok` : ""}${e.meta?.task ? ` · ${esc(e.meta.task)}` : ""}`
      : (e.meta?.provider ? esc(e.meta.provider) : "");
    return `<tr>
      <td>${esc(e.email)}</td>
      <td><span class="kind-pill ${esc(e.kind)}">${esc(e.kind)}</span></td>
      <td class="num">${e.kind === "run" ? "−" : "+"}${money(e.amountCents)}</td>
      <td>${detail}</td>
      <td>${esc(when(e.at))}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" class="muted">No activity yet.</td></tr>`;
}

$("#refresh").addEventListener("click", load);
load();
