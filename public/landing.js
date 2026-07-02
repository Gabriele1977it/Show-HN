// Landing page: render the pricing cards from the public plan catalog, with a
// monthly / annual toggle mirroring the in-app Upgrade tab. CTAs go to /app,
// where the real (Stripe) checkout happens.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
document.getElementById("yr").textContent = new Date().getFullYear();
const featLabel = { sharing: "Public deck sharing", reminders: "Review reminders", stats: "Study dashboard", enrich: "AI card-back fill" };

let plans = [];
let interval = "month";

function priceBlock(p) {
  if (p.price === 0) return `<div class="price">Free<span></span></div>`;
  if (interval === "year" && p.priceYear) {
    const perMo = (p.priceYear / 12).toFixed(2).replace(/\.00$/, "");
    return `<div class="price">$${perMo}<span>/mo</span></div>`
      + `<div class="price-sub">$${p.priceYear} billed yearly${p.yearSavingPct ? ` · save ${p.yearSavingPct}%` : ""}</div>`;
  }
  return `<div class="price">$${p.price}<span>/mo</span></div>`
    + (p.priceYear ? `<div class="price-sub">or $${p.priceYear}/yr</div>` : "");
}

function render() {
  const host = document.getElementById("lp-pricing");
  if (!host) return;
  host.innerHTML = "";
  for (const p of plans) {
    const limit = (v, u) => (v === null ? `Unlimited ${u}` : `${v} ${u}`);
    const feats = Object.keys(featLabel).map((f) => `<li class="${p.features[f] ? "" : "off"}">${featLabel[f]}</li>`).join("");
    const card = document.createElement("div");
    card.className = `plan-card${p.id === "pro" ? " featured" : ""}`;
    card.innerHTML = `
      ${p.id === "pro" ? '<span class="plan-badge">Most popular</span>' : ""}
      <h3>${p.name}</h3>
      ${priceBlock(p)}
      <div class="blurb">${esc(p.blurb)}</div>
      <ul>
        <li>${limit(p.maxDecks, "decks")}</li>
        <li>${limit(p.maxCards, "cards")}</li>
        <li>${limit(p.maxMembers, p.maxMembers === 1 ? "member" : "members")}</li>
        ${feats}
      </ul>
      <div class="cta"><a href="/app" class="lp-cta ${p.id === "pro" ? "primary" : "ghost"}" style="width:100%;box-sizing:border-box">${p.price === 0 ? "Start free" : "Choose " + p.name}</a></div>`;
    host.appendChild(card);
  }
}

function setBilling(next) {
  interval = next;
  document.getElementById("lp-bill-month").classList.toggle("is-active", next === "month");
  document.getElementById("lp-bill-year").classList.toggle("is-active", next === "year");
  render();
}
document.getElementById("lp-bill-month").addEventListener("click", () => setBilling("month"));
document.getElementById("lp-bill-year").addEventListener("click", () => setBilling("year"));

try {
  plans = await (await fetch("/api/plans")).json();
  const bestSave = Math.max(0, ...plans.map((p) => p.yearSavingPct || 0));
  document.getElementById("lp-bill-save").textContent = bestSave ? `save ${bestSave}%` : "";
  render();
} catch {}
