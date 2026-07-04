# SWE-Bench Copilot — Phase 1: Real AI Integration

This folder contains the rebuilt backend core for the SWE-Bench Copilot MVP.
It replaces the 3-second `setTimeout` mock with a real call to Anthropic's
Claude API. Your UI pages, Clerk auth, `proxy.ts`, and database schema stay
exactly as they are — **only the three files in `lib/` change.**

---

## Review of the current code (why these files were rebuilt)

1. **The mock lived inside `lib/db.ts`.** Mixing AI logic with database code
   makes both hard to change. The AI workflow now lives in its own file,
   `lib/agent.ts`, and `lib/db.ts` is pure database code again.
2. **No error path.** If the AI (or anything else) failed, a task would be
   stuck on "running" forever. There is now a `failed` status: the task's
   diff panel shows the human-readable reason.
3. **Server Actions were unauthenticated.** Server Actions are public HTTP
   endpoints — anyone on the internet could have inserted tasks into your
   database without logging in. Both actions now check Clerk's `auth()` first.
4. **No input validation.** The ingest action now requires a real GitHub
   issue URL shape, and the status action only accepts known statuses.
5. **`project_name` was hardcoded to `'Client Repo'`.** It is now derived
   from the URL (e.g. `vercel/next.js`).
6. **`ssl: { rejectUnauthorized: false }`** skips certificate verification.
   Kept for now so nothing breaks, but flagged in a comment — before launch,
   download Aiven's `ca.pem` and verify properly.
7. **Model choice:** the handoff suggested Claude 3.5 Sonnet — that model was
   retired in October 2025. This uses `claude-opus-4-8`, the current
   most capable Opus model, with adaptive thinking and streaming.

The rest of the architecture (Next.js 16 + Clerk + Aiven Postgres + the
Kanban/admin UI) is sound. No full rebuild needed.

---

## Step 1 — Install the Anthropic SDK

In Terminal, inside your project folder:

```bash
npm install @anthropic-ai/sdk
```

## Step 2 — Add the API key

```bash
nano .env.local
```

Add these lines at the bottom (get the key from https://platform.claude.com → API Keys):

```env
ANTHROPIC_API_KEY=sk-ant-...
# Optional, for higher GitHub rate limits / private repos:
# GITHUB_TOKEN=ghp_...
```

Save with `Ctrl+O`, `Enter`, then exit with `Ctrl+X`.

## Step 3 — Create lib/agent.ts (new file)

```bash
nano lib/agent.ts
```

Paste the full contents of [`lib/agent.ts`](lib/agent.ts) from this folder. Save and exit.

## Step 4 — Replace lib/db.ts

```bash
nano lib/db.ts
```

Delete everything (`Ctrl+K` repeatedly, or select-all and delete), paste the
full contents of [`lib/db.ts`](lib/db.ts) from this folder. Save and exit.

## Step 5 — Replace lib/actions.ts

```bash
nano lib/actions.ts
```

Same again — replace with the contents of [`lib/actions.ts`](lib/actions.ts). Save and exit.

## Step 6 — Restart and test

```bash
npm run dev -- -p 3001
```

Open http://localhost:3001/dashboard, log in, and submit a real public
GitHub issue URL, for example:

```
https://github.com/vercel/next.js/issues/12345
```

The task appears as **running**, and after roughly 30–90 seconds (real AI
work, not a timer) it moves to **review** with a genuine diff, the agent's
notes, and its self-assessed scores. Refresh the page to see the update.
If anything goes wrong (bad URL, missing API key, GitHub rate limit), the
task moves to **failed** with the reason shown in the diff panel.

---

## How it works now

```
User submits issue URL
        │
ingestIssueAction  (checks Clerk login, validates URL)
        │
createTask         (row inserted, status = 'running')
        │
runAgentWorkflow   (background — the page responds immediately)
        ├─ fetches the issue title/body from the GitHub API
        ├─ sends it to Claude (claude-opus-4-8, streaming, adaptive thinking)
        │    → the API enforces a JSON schema, so the reply always contains
        │      agent_diff, summary, tests_passed, tests_failed, code_quality
        ├─ success → completeTask  (status = 'review', scores filled in)
        └─ failure → failTask      (status = 'failed', reason in diff panel)
```

## Honest limitations (so you can pitch this accurately)

- **The test scores are the AI's self-estimate**, not a real SWE-Bench
  harness run. Actually executing the repo's test suite against the diff
  requires sandboxed code execution — that is a later phase, and it pairs
  naturally with Phase 2 (GitHub sync), when you'll have a clone of the repo.
- **The AI can't see the repository yet**, only the issue text, so diffs are
  a well-reasoned proposal with stated assumptions. Phase 2 fixes this too.
- **Background work and Vercel:** the fire-and-forget call works perfectly
  on `localhost`. On Vercel (Phase 4), serverless functions can be frozen
  after the response is sent, so the workflow will need `waitUntil()` or a
  job queue (e.g. Inngest, QStash). Noted here so it doesn't surprise you.
- **Cost:** each task is one Claude call — typically a few cents. If you
  later want cheaper runs at lower quality, `claude-haiku-4-5` is the
  budget option; that's a business decision, the code change is one line.
