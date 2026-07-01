// Landing page: render the pricing cards from the public plan catalog.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
document.getElementById("yr").textContent = new Date().getFullYear();
const featLabel = { sharing: "Public deck sharing", reminders: "Review reminders", stats: "Study dashboard", enrich: "AI card-back fill" };
try {
  const plans = await (await fetch("/api/plans")).json();
  const host = document.getElementById("lp-pricing");
  for (const p of plans) {
    const limit = (v, u) => (v === null ? `Unlimited ${u}` : `${v} ${u}`);
    const feats = Object.keys(featLabel).map((f) => `<li class="${p.features[f] ? "" : "off"}">${featLabel[f]}</li>`).join("");
    const card = document.createElement("div");
    card.className = `plan-card${p.id === "pro" ? " featured" : ""}`;
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
      <div class="cta"><a href="/app" class="lp-cta ${p.id === "pro" ? "primary" : "ghost"}" style="width:100%;box-sizing:border-box">${p.price === 0 ? "Start free" : "Choose " + p.name}</a></div>`;
    host.appendChild(card);
  }
} catch {}
