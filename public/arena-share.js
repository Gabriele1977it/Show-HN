// Agent Arena — public scorecard viewer.
// Reads the scorecard id from the path (/arena/s/:id), fetches it, and renders
// the leaderboard + per-agent result cards. Read-only; no run controls.

(function () {
    const $ = (id) => document.getElementById(id);
    const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    // Theme toggle (pre-paint script in <head> already applied the saved theme).
    const themeToggle = $('themeToggle');
    const syncToggle = () => {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        themeToggle.textContent = dark ? '☀️' : '🌙';
    };
    syncToggle();
    themeToggle.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('arena-theme', next); } catch (e) { /* ignore */ }
        syncToggle();
    });

    const id = location.pathname.split('/').filter(Boolean).pop();
    const main = $('main');

    fetch(`/api/arena/scorecards/${encodeURIComponent(id)}`)
        .then((res) => {
            if (!res.ok) throw new Error(res.status === 404 ? 'This scorecard was not found.' : `Error ${res.status}`);
            return res.json();
        })
        .then(render)
        .catch((err) => {
            main.innerHTML = `<div class="empty"><h1>😕 ${escapeHtml(err.message)}</h1>
                <p style="margin-top:12px;"><a class="btn" href="/arena" style="margin-top:16px;">⚡ Run a benchmark</a></p></div>`;
        });

    function render(card) {
        const results = [...(card.results || [])].sort((a, b) => b.totalScore - a.totalScore);
        const date = card.createdAt ? new Date(card.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';

        const scorecard = results.map((r, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
            const cls = i === 0 ? 'medal-gold' : i === 1 ? 'medal-silver' : i === 2 ? 'medal-bronze' : '';
            return `<div class="scorecard-item">
                <div class="rank ${cls}">${medal}</div>
                <div class="sname">${escapeHtml(r.name)}</div>
                <div class="selo">Sim. ELO ${Math.round(1200 + r.totalScore * 0.9)}</div>
                <div class="sdim">${r.totalScore} pts · ${Math.round(r.dimensions?.accuracy || 0)}% Acc</div>
            </div>`;
        }).join('');

        const cards = results.map((r) => `
            <div class="result-card">
                <div class="card-head">
                    <div class="agent-info">
                        <div class="avatar" style="background:${/^#[0-9a-fA-F]{3,8}$/.test(r.color) ? r.color : '#7c3aed'}">${escapeHtml((r.name || '?')[0])}</div>
                        <div><strong>${escapeHtml(r.name)}</strong> <span style="font-size:0.75rem;color:var(--text-secondary);">${escapeHtml(r.provider || '')}</span>${r.live ? ' <span style="font-size:0.6rem;font-weight:700;text-transform:uppercase;color:#16a34a;background:rgba(22,163,74,0.12);padding:1px 8px;border-radius:40px;">● Live</span>' : ''}</div>
                    </div>
                    <div class="score-badge">${r.totalScore} pts</div>
                </div>
                <div class="output">${escapeHtml(r.output || '')}</div>
                <div class="card-footer">
                    <span>⏱️ ${r.latency ?? '—'}s</span>
                    <span>💰 $${(r.cost ?? 0).toFixed(4)}</span>
                    <span>🎯 ${Math.round(r.dimensions?.accuracy || 0)}% Acc</span>
                    <span>📌 ${Math.round(r.dimensions?.relevance || 0)}% Rel</span>
                </div>
            </div>
        `).join('');

        main.innerHTML = `
            <section class="hero">
                <span class="badge">🏁 Published scorecard</span>
                <h1>${escapeHtml(card.taskEmoji || '⚡')} ${escapeHtml(card.task || 'Benchmark')}</h1>
                <p class="sub"><strong>${escapeHtml(card.winner || '—')}</strong> won · ${card.agentCount || results.length} agents compared${date ? ' · ' + escapeHtml(date) : ''}</p>
            </section>
            <div class="demo-notice">🧪 Demo mode — these agent outputs and scores were simulated in the browser.</div>
            <div class="scorecard-panel">
                <h5>🏆 Leaderboard</h5>
                <div class="scorecard-grid">${scorecard}</div>
            </div>
            <div class="comparison-grid">${cards}</div>
            <div class="cta-row"><a class="btn" href="/arena">⚡ Run your own benchmark</a></div>
        `;
    }
})();
