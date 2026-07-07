// Agent Arena — public leaderboard.
// Aggregate model ranking + a searchable list of published scorecards.

(function () {
    const $ = (id) => document.getElementById(id);
    const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
    const safeColor = (c) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#7c3aed');
    function timeAgo(ts) {
        const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
        if (s < 60) return `${s}s ago`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    }

    // Theme toggle (pre-paint script already applied the saved theme).
    const themeToggle = $('themeToggle');
    const syncToggle = () => {
        themeToggle.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    };
    syncToggle();
    themeToggle.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('arena-theme', next); } catch (e) { /* ignore */ }
        syncToggle();
    });

    const taskFilter = $('taskFilter');
    const searchBox = $('searchBox');
    let tasksLoaded = false;

    function loadLeaderboard() {
        const task = taskFilter.value;
        fetch(`/api/arena/leaderboard${task ? `?task=${encodeURIComponent(task)}` : ''}`)
            .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then((data) => {
                $('heroSub').textContent = data.totalScorecards
                    ? `Ranked across ${data.totalScorecards} published scorecard${data.totalScorecards === 1 ? '' : 's'}.`
                    : 'Be the first to publish a scorecard from the arena.';

                // Populate the task filter once (from the unfiltered facet list).
                if (!tasksLoaded && data.tasks) {
                    tasksLoaded = true;
                    for (const t of data.tasks) {
                        const opt = document.createElement('option');
                        opt.value = t.name;
                        opt.textContent = `${t.name} (${t.count})`;
                        taskFilter.appendChild(opt);
                    }
                }

                const body = $('rankBody');
                if (!data.models || !data.models.length) {
                    body.innerHTML = '';
                    $('rankEmpty').style.display = 'block';
                    return;
                }
                $('rankEmpty').style.display = 'none';
                body.innerHTML = data.models.map((m, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                    const cls = i === 0 ? 'medal-gold' : i === 1 ? 'medal-silver' : i === 2 ? 'medal-bronze' : '';
                    return `<tr>
                        <td class="rank-cell ${cls}">${medal}</td>
                        <td>
                            <div class="model-cell">
                                <div class="avatar" style="background:${safeColor(m.color)}">${escapeHtml((m.name || '?')[0])}</div>
                                <div>
                                    <div class="mname">${escapeHtml(m.name)}</div>
                                    <div class="mprov">${escapeHtml(m.provider || '')}</div>
                                </div>
                            </div>
                        </td>
                        <td class="num"><span class="avg-pill">${m.avgScore}</span></td>
                        <td class="num">${m.winRate}% <span style="color:var(--text-muted);font-size:0.8em;">(${m.wins}/${m.appearances})</span></td>
                        <td class="num">${m.appearances}</td>
                    </tr>`;
                }).join('');
            })
            .catch(() => { $('rankEmpty').style.display = 'block'; });
    }

    function loadCards() {
        const task = taskFilter.value;
        const q = searchBox.value.trim();
        const params = new URLSearchParams({ limit: '30' });
        if (task) params.set('task', task);
        if (q) params.set('q', q);
        fetch(`/api/arena/scorecards?${params}`)
            .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then((cards) => {
                const grid = $('cardsGrid');
                if (!cards.length) {
                    grid.innerHTML = '';
                    $('cardsEmpty').style.display = 'block';
                    return;
                }
                $('cardsEmpty').style.display = 'none';
                grid.innerHTML = cards.map((c) => `
                    <a class="community-card" href="/arena/s/${encodeURIComponent(c.id)}">
                        <div class="cc-task">${escapeHtml(c.taskEmoji || '⚡')} ${escapeHtml(c.task || 'Task')}</div>
                        <div class="cc-meta"><span class="cc-winner">🥇 ${escapeHtml(c.winner || '—')}</span> · ${c.winnerScore || 0} pts · ${c.agentCount || 0} agents</div>
                        <div class="cc-date">${timeAgo(c.createdAt)}</div>
                    </a>
                `).join('');
            })
            .catch(() => { $('cardsEmpty').style.display = 'block'; });
    }

    // Debounce the search box so we don't fire a request per keystroke.
    let searchTimer = null;
    searchBox.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadCards, 250);
    });
    taskFilter.addEventListener('change', () => { loadLeaderboard(); loadCards(); });

    loadLeaderboard();
    loadCards();
})();
