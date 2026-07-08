// Agent Arena — blind-vote page.
// Two models answer the same task with names hidden; the visitor picks the
// winner and the vote updates a crowd-sourced ELO leaderboard.

(function () {
    const $ = (id) => document.getElementById(id);
    const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const safeColor = (c) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#7c3aed');
    const MOCKS = window.ARENA_MOCKS || { tasks: [], providerMocks: {}, defaultMock: {} };

    // Theme toggle (pre-paint script applied the saved theme).
    const themeToggle = $('themeToggle');
    const syncToggle = () => { themeToggle.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'; };
    syncToggle();
    themeToggle.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('arena-theme', next); } catch (e) { /* ignore */ }
        syncToggle();
    });

    let models = [];        // flattened [{ id, name, provider, color }]
    let current = null;     // { task, a, b }
    let voting = false;

    function mockFor(provider, taskId) {
        const p = MOCKS.providerMocks[provider];
        if (p && p[taskId]) return p[taskId];
        return MOCKS.defaultMock[taskId] || 'No response.';
    }

    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Pick a task + two models from DIFFERENT providers (so the two simulated
    // answers actually differ), then randomise which side each lands on.
    function newMatchup() {
        const task = rand(MOCKS.tasks);
        const a = rand(models);
        let b = rand(models);
        let guard = 0;
        while ((b.provider === a.provider) && guard++ < 40) b = rand(models);
        const pair = Math.random() < 0.5 ? [a, b] : [b, a];
        current = { task, a: pair[0], b: pair[1] };

        $('taskbar').innerHTML = `Task: <strong>${escapeHtml(task.emoji + ' ' + task.title)}</strong> — ${escapeHtml(task.desc)}`;
        $('labelA').textContent = 'Model A';
        $('labelB').textContent = 'Model B';
        $('revealA').innerHTML = '';
        $('revealB').innerHTML = '';
        $('bodyA').textContent = mockFor(current.a.provider, task.id);
        $('bodyB').textContent = mockFor(current.b.provider, task.id);
        $('sideA').classList.remove('win');
        $('sideB').classList.remove('win');
        $('nextRow').innerHTML = '';
        setVoteButtons(true);
    }

    function setVoteButtons(enabled) {
        document.querySelectorAll('#votebar .btn').forEach((b) => { b.disabled = !enabled; b.classList.remove('win'); });
    }

    function revealSide(side, model, delta) {
        const dcls = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
        const dtxt = delta > 0 ? `+${delta}` : `${delta}`;
        $('reveal' + side).innerHTML =
            `<span class="avatar" style="background:${safeColor(model.color)}">${escapeHtml((model.name || '?')[0])}</span>` +
            `${escapeHtml(model.name)} <span class="delta ${dcls}">${dtxt} ELO</span>`;
    }

    async function vote(winner) {
        if (voting || !current) return;
        voting = true;
        setVoteButtons(false);
        try {
            const res = await fetch('/api/arena/vote', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: current.task.title,
                    a: { id: current.a.id, name: current.a.name, provider: current.a.provider, color: current.a.color },
                    b: { id: current.b.id, name: current.b.name, provider: current.b.provider, color: current.b.color },
                    winner,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { $('nextRow').innerHTML = `<span class="voted-note">Couldn't record that vote — try again.</span>`; voting = false; setVoteButtons(true); return; }
            revealSide('A', current.a, data.a ? data.a.delta : 0);
            revealSide('B', current.b, data.b ? data.b.delta : 0);
            if (winner === 'a') $('sideA').classList.add('win');
            if (winner === 'b') $('sideB').classList.add('win');
            $('nextRow').innerHTML = `<button class="btn primary" id="nextBtn">Next matchup →</button>`;
            $('nextBtn').addEventListener('click', () => { voting = false; newMatchup(); });
            loadLeaderboard();
        } catch (e) {
            $('nextRow').innerHTML = `<span class="voted-note">Network error — try again.</span>`;
            voting = false; setVoteButtons(true);
        }
    }

    function loadLeaderboard() {
        fetch('/api/arena/vote/leaderboard?limit=15')
            .then((r) => r.ok ? r.json() : Promise.reject())
            .then((data) => {
                $('voteCount').textContent = data.totalVotes ? `· ${data.totalVotes} vote${data.totalVotes === 1 ? '' : 's'} from ${data.totalModels} models` : '';
                if (!data.models || !data.models.length) return;
                $('lbBody').innerHTML = data.models.map((m, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                    const cls = i === 0 ? 'medal-gold' : i === 1 ? 'medal-silver' : i === 2 ? 'medal-bronze' : '';
                    return `<tr>
                        <td class="rank ${cls}">${medal}</td>
                        <td><div class="m-cell"><div class="avatar" style="background:${safeColor(m.color)}">${escapeHtml((m.name || '?')[0])}</div><div><div>${escapeHtml(m.name)}</div><div class="mprov">${escapeHtml(m.provider || '')}</div></div></div></td>
                        <td class="num"><span class="elo-pill">${m.rating}</span></td>
                        <td class="num">${m.winRate}%</td>
                        <td class="num">${m.games}</td>
                    </tr>`;
                }).join('');
            })
            .catch(() => { /* offline */ });
    }

    document.querySelectorAll('#votebar .btn').forEach((b) => b.addEventListener('click', () => vote(b.dataset.vote)));

    // Boot: load the live model registry, then start.
    fetch('/api/arena/models')
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((data) => {
            for (const [provider, info] of Object.entries(data.providers || {})) {
                for (const m of info.models || []) models.push({ id: m.id, name: m.name, provider, color: info.color });
            }
        })
        .catch(() => {
            // Fallback: derive models from the mock providers if the API is down.
            for (const provider of Object.keys(MOCKS.providerMocks)) models.push({ id: provider.toLowerCase(), name: provider, provider, color: '#7c3aed' });
        })
        .finally(() => {
            if (models.length >= 2 && MOCKS.tasks.length) newMatchup();
            else $('taskbar').textContent = 'Could not load models — please refresh.';
            loadLeaderboard();
        });
})();
