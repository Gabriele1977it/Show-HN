# SWE-Bench Copilot (MadlabsUk)

A web app for small software teams adopting AI workflows: paste a GitHub
issue, a real AI agent (Anthropic Claude) writes the code fix, scores its own
work, and drops the diff into a review queue where a senior engineer clicks
**Approve** or **Reject**.

This is a **complete rebuild from scratch** — everything from the original
MVP plus Phase 1 (real AI integration, no more mock timer) already done:

- Next.js 16 (App Router, TypeScript, Tailwind CSS v4, `proxy.ts` for middleware)
- Clerk authentication (login / signup)
- PostgreSQL (Aiven) via `pg`
- Anthropic Claude API (`claude-opus-4-8`) writing real diffs
- Dark-themed landing page, Kanban dashboard, admin ops queue, task detail
  page with scores + diff + Approve/Reject
- Auto-refreshing board while the agent works, and a `failed` status with
  the human-readable reason when something goes wrong
- `npm run db:setup` creates the database table for you — no SQL to type

---

## Setup from zero (Mac)

You need three free-tier cloud accounts (Aiven, Clerk, Anthropic). Each step
tells you exactly what to copy where. Total time: ~20 minutes.

### Step 0 — Install Node.js (skip if you already have it)

Check first, in Terminal:

```bash
node --version
```

If that prints `v20` or higher you're fine. Otherwise download the LTS
installer from https://nodejs.org and run it.

### Step 1 — Get this code onto your Mac

```bash
cd ~/Documents
git clone -b claude/swe-bench-copilot-review-lo60tw https://github.com/Gabriele1977it/Show-HN.git
cd Show-HN/swe-bench-copilot
```

(Alternative without git: on the GitHub page, pick the
`claude/swe-bench-copilot-review-lo60tw` branch, press **Code → Download
ZIP**, unzip, then `cd` into the `swe-bench-copilot` folder inside it.)

### Step 2 — Install the dependencies

```bash
npm install
```

### Step 3 — Create your three cloud services

1. **Database (Aiven):** at https://console.aiven.io create a free
   PostgreSQL service. When it's running, copy the **Service URI** (starts
   with `postgres://`).
2. **Login (Clerk):** at https://dashboard.clerk.com create an application
   (enable Email + Google). Open **API Keys** and keep the page open — you
   need the *Publishable key* (`pk_test_...`) and *Secret key* (`sk_test_...`).
3. **AI (Anthropic):** at https://platform.claude.com create an API key
   (`sk-ant-...`). You'll need a small credit balance ($5 is plenty to start;
   each task costs a few cents).

### Step 4 — Create your .env.local

```bash
cp .env.local.example .env.local
nano .env.local
```

Paste your real values over the placeholders. Save with `Ctrl+O`, `Enter`,
exit with `Ctrl+X`.

### Step 5 — Create the database table

```bash
npm run db:setup
```

You should see: `✅ Database ready — 'tasks' table exists (0 rows).`

### Step 6 — Run it

```bash
npm run dev
```

Open http://localhost:3001 (port 3001 is already configured because 3000 is
busy on your machine). Sign up, then on the dashboard paste a real public
GitHub issue URL, e.g.:

```
https://github.com/expressjs/express/issues/5555
```

The card appears under **In Progress** and the board refreshes itself; after
~30–90 seconds of real AI work it moves to **Needs Review**. Click
**View diff →** to see the proposed change, the agent's notes, the scores,
and the Approve / Reject buttons.

---

## Project structure

```
swe-bench-copilot/
├── proxy.ts                      # Clerk middleware (Next 16 uses proxy.ts)
├── app/
│   ├── page.tsx                  # Dark landing page
│   ├── login/[[...rest]]/        # Clerk <SignIn />
│   ├── signup/[[...rest]]/       # Clerk <SignUp />
│   ├── dashboard/page.tsx        # Kanban board + issue ingest form
│   ├── admin/page.tsx            # Ops queue (all tasks, table view)
│   └── admin/tasks/[id]/page.tsx # Scores + diff + Approve/Reject
├── components/AutoRefresh.tsx    # Refreshes the board while agent runs
├── lib/
│   ├── db.ts                     # Postgres queries (no AI logic here)
│   ├── agent.ts                  # The real AI workflow (Claude API)
│   └── actions.ts                # Server Actions (auth-checked, validated)
├── scripts/setup-db.mjs          # npm run db:setup
└── .env.local.example            # Template for your secrets
```

## How a task flows

```
User submits issue URL
        │
ingestIssueAction   (checks Clerk login, validates the URL)
        │
createTask          (row inserted, status = 'running')
        │
runAgentWorkflow    (background — the page responds immediately)
        ├─ fetches the issue title/body from the GitHub API
        ├─ sends it to Claude (claude-opus-4-8, streaming, adaptive thinking;
        │   the API enforces a JSON schema so the reply always parses)
        ├─ success → status 'review' with diff + notes + scores
        └─ failure → status 'failed' with the reason in the diff panel
```

## Honest limitations (for your pitch)

- **Test scores are the AI's self-estimate**, not a real SWE-Bench harness
  run — actually executing the repo's tests needs sandboxed code execution
  (pairs with Phase 2, when the app can clone the repo).
- **The AI sees only the issue text**, not the codebase, so diffs are a
  well-reasoned proposal with stated assumptions. Phase 2 fixes this.
- **Fire-and-forget works on localhost.** On Vercel (Phase 4), background
  work needs `waitUntil()` or a job queue (Inngest / QStash).
- `ssl: { rejectUnauthorized: false }` in `lib/db.ts` and the setup script
  skips certificate checks — fine for development; before launch, use
  Aiven's `ca.pem`.

## Roadmap

- ✅ Phase 1 — Real AI integration (done, this build)
- Phase 2 — GitHub OAuth + repo sync: watch `ai-task` labels, clone the
  repo, open real Pull Requests
- Phase 3 — Stripe payments ($49/mo paywall)
- Phase 4 — Deploy to Vercel + custom domain (swe.madlabs.uk)
