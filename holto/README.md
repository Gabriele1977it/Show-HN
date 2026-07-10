# HOLTO

**An honest travel-disruption companion.** When a flight is delayed or cancelled,
HOLTO explains the traveller's passenger rights (UK261 / EU261 guidance) in plain
English, gives a calm step-by-step checklist, and **proactively monitors** the
flight — pushing an alert the moment its status changes, even with the app closed.

> Brand promise: **Travel. Relocate. Live better abroad.** The founder's background
> is fraud analysis, so trust and straight talk are the whole point — HOLTO never
> invents rights or amounts, and always points to the official process for anything
> binding.

HOLTO is part of the [MadLabs](../README.md) umbrella but, unlike EchoDeck and
Agent Arena, it is a **self-contained pnpm monorepo** with its own stack and
deploys independently.

## Stack

- **App** — Expo / React Native (Expo Router), also builds for web (`artifacts/holto`)
- **API** — Express 5, PostgreSQL + Drizzle ORM, OpenAI (AI companion), AirLabs
  (live flight data), Stripe (billing) (`artifacts/api-server`)
- **Worker** — background flight-monitoring poller → push + email alerts. Runs as
  a second entry point of the API package (`artifacts/api-server`, `src/worker.ts`)
  so it shares the flight-lookup, db, and alert code.
- **Shared libs** — `lib/db` (schema), `lib/api-spec` (OpenAPI), `lib/api-zod`,
  `lib/api-client-react` (generated hooks)
- pnpm workspaces, Node 24, TypeScript 5.9, esbuild

## Run locally

```bash
cd holto
pnpm install
cp .env.example .env            # then fill in the values (see below)

# 1. Point DATABASE_URL at a Postgres instance, then push the schema:
pnpm --filter @workspace/db run push

# 2. Start the API (port 5000):
pnpm --filter @workspace/api-server run dev

# 3. Start the monitoring worker (separate terminal):
pnpm --filter @workspace/api-server run dev:worker

# 4. Start the app (Expo):
pnpm --filter holto run start
```

Useful workspace scripts:

```bash
pnpm run typecheck   # full typecheck across every package
pnpm run build       # typecheck + build all packages
pnpm --filter @workspace/api-spec run codegen   # regenerate API hooks + Zod from OpenAPI
```

## Environment variables

Copy `.env.example` to `.env`. Required unless noted.

| Var | Used by | Meaning |
|-----|---------|---------|
| `DATABASE_URL` | api, worker, db | Postgres connection string. |
| `PORT` | api | HTTP port (Render/hosts inject this). |
| `SESSION_SECRET` | api | Secret for signing JWT session tokens. |
| `OPENAI_API_KEY` | api, worker | OpenAI key for the AI companion + status messages. |
| `AIRLABS_API_KEY` | api, worker | AirLabs key for live flight status. |
| `EXPO_ACCESS_TOKEN` | worker | _(optional)_ Expo push access token for higher throughput. |
| `EMAIL_WEBHOOK_URL` | worker | _(optional)_ Outbound webhook for email fallback alerts (provider relay / Zapier). Logs to console if unset. |
| `APP_ORIGIN` / `PUBLIC_URL` | api | Public base URL of the deployed API (CORS + Stripe webhook URL). |
| `ALLOWED_ORIGINS` | api | _(optional)_ Extra CORS origins, comma-separated. |
| `MONITOR_POLL_MS` | worker | _(optional)_ Poll interval, default 15 min. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | api | _(optional)_ Enables real billing. |

## Proactive monitoring (how it works)

1. The app registers an **Expo push token** (`POST /api/push/register`) after the
   user grants notification permission.
2. Users track a flight (`POST /api/flights/monitor`), stored in `monitored_flights`.
3. The **worker** (`artifacts/api-server/src/worker.ts`) polls every
   `MONITOR_POLL_MS`, fetches each active flight's status through the shared
   `lib/flights.ts`, and writes `lastStatus` / `lastStatusData` / `lastCheckedAt` back.
4. When `detectStatusChange(prev, next)` reports a **material change** (→ cancelled
   / diverted / incident, or a delay crossing the threshold), the worker sends a
   **push notification** (and an **email fallback** when no push token exists),
   deep-linking the traveller into the Disruption Rescue flow. Alerts are throttled
   per flight so the same state is never announced twice.

## Compensation claims

HOLTO doesn't stop at explaining rights — it helps travellers **recover** the money
and track the claim to payment:

1. From a disruption, `POST /api/claims` generates an authoritative claim (letter +
   amount, both computed deterministically via `lib/eu261.ts` — never invented) and
   stores it. Idempotent per disruption.
2. The claim moves through a validated lifecycle: `draft → submitted →
   airline_responded → paid | rejected → escalated → closed`, with an append-only
   timeline. `PATCH /api/claims/:id` advances status / records a reference or the
   amount received.
3. `GET /api/claims/:id/letter` returns the ready-to-send letter plus **factual**
   escalation guidance (UK CAA / EU National Enforcement Body / ADR / small claims —
   no fabricated airline contacts).

In the app: the disruption screen has a **Start your compensation claim** action, and
the History tab lists every claim with its live status → a claim tracker
(`app/claim/[id].tsx`) that shows the letter, status stepper, timeline, and escalation.

## Deploy

**Non-technical walkthrough: see [`DEPLOY.md`](DEPLOY.md).**

The repo-root `render.yaml` (on this branch) is a Render **Blueprint** that stands
up a web API + a managed Postgres database — with almost no manual setup. To keep
costs low the flight monitor runs **inside** the API service (`ENABLE_MONITOR=1`)
rather than as a separate paid worker; a dedicated worker is still available
(`pnpm --filter @workspace/api-server start:worker`) if you prefer to split it out.

- `DATABASE_URL` is injected from the managed database automatically.
- `SESSION_SECRET` is auto-generated (`generateValue: true`).
- Database tables are created automatically via `preDeployCommand`
  (`pnpm --filter @workspace/db run push-force`).
- `OPENAI_API_KEY` and `AIRLABS_API_KEY` are **optional** (`sync:false`, may be
  left blank): the app boots and serves accounts, deterministic rights, and claims
  without them; add them to enable AI wording and live flight tracking.

To deploy: Render → **New + → Blueprint** → select this repo and the
`claude/holto-app-improvements-8cefxv` branch → **Apply**. Health check is
`/api/healthz`. (Render only auto-detects a blueprint at the repo root, so it lives
there rather than under `holto/`. EchoDeck's blueprint lives on its own branch.)

For the mobile app, build with EAS (`eas build`) and point it at the deployed API
base URL (the app configures this via `setBaseUrl` in `lib/api-client-react`).
Native push requires a real device / EAS build — the Expo Go client cannot receive
remote push in all cases.
