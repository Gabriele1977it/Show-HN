// Owner admin dashboard.
//
// Read-only monitoring (totals, plan mix, today's AI/import usage, latest
// workspaces & accounts) plus one action: set a workspace's plan — the way
// the operator grants the beta-tester tier. Auth is the owner's session token
// (same localStorage key the app uses); the server enforces OWNER_EMAILS.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const session = localStorage.getItem("echodeck_session") || "";
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", "X-Session": session, ...(opts.headers || {}) } });
  if (!r.ok) throw Object.assign(new Error((await r.json().catch(() => ({}))).error || "Request failed"), { status: r.status });
  return r.json();
}

function tile(label, value, sub = "") {
  return `<div class="metric"><div class="value">${esc(value)}</div><div class="muted small">${esc(label)}${sub ? ` · ${esc(sub)}` : ""}</div></div>`;
}

function planPill(plan) {
  return `<span class="plan-pill ${esc(plan)}">${esc(plan)}</span>`;
}

async function load() {
  let o;
  try {
    o = await api("/api/admin/overview");
  } catch (err) {
    $("#gate").classList.remove("hidden");
    $("#dash").classList.add("hidden");
    if (err.status !== 403 && err.status !== 401) $("#gate h2").textContent = "Couldn't load the dashboard";
    return;
  }
  $("#gate").classList.add("hidden");
  $("#dash").classList.remove("hidden");
  $("#stamp").textContent = `as of ${new Date().toLocaleTimeString()}`;

  const t = o.totals;
  const planMix = Object.entries(o.plans).map(([p, n]) => `${p} ${n}`).join(" · ");
  $("#tiles").innerHTML = [
    tile("accounts", t.accounts),
    tile("workspaces", t.workspaces, planMix),
    tile("decks", t.decks, `${t.shared} shared · ${t.listed} listed`),
    tile("cards", t.cards),
    tile("reviews (all time)", t.reviews),
    tile("reviews (24h)", o.reviews24h),
  ].join("");
  $("#usage-tiles").innerHTML = [
    tile("AI card fills today", o.usageToday.aiFills),
    tile("URL/YouTube imports today", o.usageToday.imports),
  ].join("");

  const wsBody = $("#ws-table tbody");
  wsBody.innerHTML = "";
  for (const w of o.recentWorkspaces) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(w.name)}</td>
      <td>${planPill(w.plan)}</td>
      <td>${w.decks}</td><td>${w.cards}</td><td>${w.members}</td>
      <td class="muted">${fmtDate(w.createdAt)}</td>
      <td></td>`;
    const sel = document.createElement("select");
    sel.innerHTML = o.planIds.map((p) => `<option value="${esc(p)}"${p === w.plan ? " selected" : ""}>${esc(p)}</option>`).join("");
    sel.addEventListener("change", async () => {
      sel.disabled = true;
      try {
        await api(`/api/admin/workspaces/${encodeURIComponent(w.id)}/plan`, { method: "POST", body: JSON.stringify({ plan: sel.value }) });
        tr.children[1].innerHTML = planPill(sel.value);
      } catch (err) {
        alert(err.message);
        sel.value = w.plan;
      } finally {
        sel.disabled = false;
      }
    });
    tr.lastElementChild.appendChild(sel);
    wsBody.appendChild(tr);
  }

  const acctBody = $("#acct-table tbody");
  acctBody.innerHTML = "";
  for (const a of o.recentAccounts) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${esc(a.email)}</td><td>${a.workspaces}</td><td class="muted">${fmtDate(a.createdAt)}</td>`;
    acctBody.appendChild(tr);
  }
}

// --- tester invites ---
async function loadInvites() {
  let invites;
  try { invites = await api("/api/admin/invites"); } catch { return; }
  const body = $("#invite-table tbody");
  body.innerHTML = "";
  if (!invites.length) {
    body.innerHTML = `<tr><td colspan="5" class="muted">No invites yet — create one and send the link to your testers.</td></tr>`;
    return;
  }
  for (const i of invites) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-family:monospace;font-size:12px">${esc(i.link)}</td>
      <td>${planPill(i.plan)}</td>
      <td>${i.uses} / ${i.maxUses}</td>
      <td class="muted">${fmtDate(i.createdAt)}</td>
      <td></td>`;
    const copy = document.createElement("button");
    copy.className = "tab";
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(i.link); copy.textContent = "Copied ✓"; setTimeout(() => (copy.textContent = "Copy"), 1500); } catch {}
    });
    tr.lastElementChild.appendChild(copy);
    body.appendChild(tr);
  }
}

$("#new-invite").addEventListener("click", async () => {
  const btn = $("#new-invite");
  btn.disabled = true;
  try {
    const inv = await api("/api/admin/invites", { method: "POST", body: JSON.stringify({ plan: "tester", maxUses: 25 }) });
    $("#invite-msg").textContent = `Created — send: ${inv.link}`;
    await loadInvites();
  } catch (err) {
    $("#invite-msg").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

// Embedded in the app's Admin tab: hide the standalone chrome.
if (new URLSearchParams(location.search).get("embed")) {
  document.querySelector(".topbar").style.display = "none";
  document.body.style.background = "transparent";
}

$("#refresh").addEventListener("click", () => { load(); loadInvites(); });
load();
loadInvites();
