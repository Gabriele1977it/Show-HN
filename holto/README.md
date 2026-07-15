# HOLTO

**The honest travel companion.** HOLTO helps constant travellers, expats and
digital nomads handle the messy parts of a life lived abroad — flight
disruptions, passenger rights, day-to-day essentials on the ground — without
ever inventing a fact. When information is uncertain, HOLTO says so and links to
the authoritative source.

> **Travel. Relocate. Live better abroad.** The founder's background is fraud
> analysis, so trust is the whole product: HOLTO never fabricates rights, amounts,
> visa rules or safety levels, and always points to the official process for
> anything binding.

Live as a PWA at **[app.holtotravel.com](https://app.holtotravel.com)**.

---

## What it does

**Disruption & rights (the core)**
- **Proactive flight monitoring** — tracks your flight and pushes an alert the
  moment its status changes, *even with the app closed*.
- **Passenger rights** — plain-English UK261 / EU261 guidance, computed
  deterministically (never invented) with a calm step-by-step checklist.
- **Compensation claims** — generates an authoritative claim letter + amount and
  tracks it through to payment, with factual escalation routes (CAA / NEB / ADR /
  small claims).

**The toolkit** — everything a constant traveller needs, in one place:

| Tool | What it does | Data source |
|------|--------------|-------------|
| Your travel day | Next flight hour-by-hour, live status | AirLabs |
| Destination guide | Plugs, emergency numbers, tap water, tipping | Bundled (offline) |
| Visa & entry | Do you need a visa? guidance + official link | Passport Index + gov.uk |
| Travel alerts | Live government safety advisories | US State Dept + travel-advisory.info |
| Cost of living | Compare a month's essentials between cities | Curated + World Bank anchor |
| Currency converter | 160+ currencies, works offline | open.er-api.com |
| eSIM data plans | Prepaid data for 190+ countries | Airalo + Stripe |
| Best light | Golden/blue hour for any place & date | Offline solar maths |
| Expenses | Scan receipts, split, export a GBP report | AI (optional) |
| Residency & tax days | Schengen 90/180, 183-day rule | Deterministic |
| Airport timing | When to leave, using live traffic | Mapbox |
| Loyalty & points | Every balance in one wallet, auto-imported | AwardWallet |
| Trips / Add from a booking | Paste a confirmation → HOLTO builds the trip | AI (optional) |
| Best light, news, weather… | plus live travel news and destination weather | Free feeds |

### The trust philosophy in practice

Every feature is built to **fail toward honesty**, and to run on free / minimum-cost
data wherever possible:

- **Deterministic first.** Rights, compensation amounts, solar times, residency
  counts and cost breakdowns are computed, not guessed.
- **Live authoritative sources, with graceful fallback.** Advisories, FX,
  flights, visa data and World Bank prices are fetched live and cached; if a feed
  is unreachable the app degrades to a safe fallback rather than showing nothing —
  or worse, something wrong.
- **Safety fails toward caution.** Travel-alert levels can only ever be *raised*
  by the automated US State Department feed (Level 3 → reconsider, Level 4 → do not
  travel) — a lagging source can never make a dangerous country look safe.
- **Always link to the authority.** Visa and safety guidance carry a clear "verify
  before you fly" disclaimer and a deep link to the official government source.

---

## Stack

- **App** — Expo / React Native (Expo Router); also builds to a PWA for web
  (`artifacts/holto`)
- **API** — Express 5, PostgreSQL + Drizzle ORM (`artifacts/api-server`)
- **AI** — Google Gemini (primary) with an OpenAI fallback, used *for wording
  only* — never to decide a fact
- **Worker** — background flight-monitoring poller → push + email alerts, a second
  entry point of the API package (`src/worker.ts`) so it shares the flight, DB and
  alert code
- **Shared libs** — `lib/db` (schema), `lib/api-spec` (OpenAPI), `lib/api-zod`,
  `lib/api-client-react` (generated hooks)
- pnpm workspaces · TypeScript 5.9 · esbuild

### Monorepo layout

```
holto/
├─ artifacts/
│  ├─ holto/         # Expo / React Native app (+ PWA)
│  ├─ api-server/    # Express API + background worker
│  └─ mockup-sandbox/
├─ lib/              # db, api-spec, api-zod, api-client-react
├─ render.yaml       # Render Blueprint (repo root)
└─ .env.example
```

---

## Run locally

```bash
cd holto
pnpm install
cp .env.example .env            # then fill in values (see below)

# 1. Point DATABASE_URL at a Postgres instance, then push the schema:
pnpm --filter @workspace/db run push

# 2. Start the API (port 5000):
pnpm --filter @workspace/api-server run dev

# 3. Start the monitoring worker (separate terminal, optional locally):
pnpm --filter @workspace/api-server run dev:worker

# 4. Start the app (Expo):
pnpm --filter @workspace/holto run start
```

Useful workspace scripts:

```bash
pnpm --filter @workspace/api-server run typecheck   # typecheck API
pnpm --filter @workspace/holto      run typecheck   # typecheck app
pnpm --filter @workspace/api-server test            # API unit tests (node:test)
pnpm --filter @workspace/api-spec   run codegen     # regenerate API hooks + Zod
```

---

## Environment variables

Copy `.env.example` to `.env`. **The app boots with almost none of these** — every
integration is optional and its feature simply stays hidden until configured, so
you can start with just `DATABASE_URL` and add capabilities incrementally.

| Var | Feature | Notes |
|-----|---------|-------|
| `DATABASE_URL` | everything | Postgres connection string. **Required.** |
| `SESSION_SECRET` | auth | Signs session tokens (auto-generated on Render). |
| `APP_ORIGIN` / `PUBLIC_URL` | api | Public API base URL (CORS + Stripe webhook). |
| `GEMINI_API_KEY` | AI wording | Ask HOLTO, status messages, booking/receipt parsing. |
| `OPENAI_API_KEY` | AI wording | Fallback if Gemini is unset. |
| `AIRLABS_API_KEY` | flights | Live flight status + monitoring. |
| `MAPBOX_TOKEN` | maps | Geocoding, airport-timing traffic, best-light. |
| `GOOGLE_MAPS_API_KEY` | Ask HOLTO | Nearby places (Places API). |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | billing, eSIM | Enables paid tiers + eSIM checkout. |
| `RESEND_API_KEY` | email | Password reset + alert fallback (free tier). |
| `EXPO_ACCESS_TOKEN` | push | Higher push throughput (optional). |
| `AWARDWALLET_API_KEY` | loyalty | Read-only balance import (free tier). |
| `AIRALO_CLIENT_ID` / `AIRALO_CLIENT_SECRET` | eSIM | Airalo Partner API. |
| `OWNER_EMAILS` | admin | Comma-separated owner accounts. |

Fully key-free feeds (**no configuration**): cost of living (World Bank), visa
guidance (Passport Index), travel alerts (US State Dept + travel-advisory.info),
FX rates (open.er-api.com).

---

## How proactive monitoring works

1. The app registers an **Expo push token** (`POST /api/push/register`) after the
   user grants notification permission.
2. Users track a flight (`POST /api/flights/monitor`), stored in `monitored_flights`.
3. The **worker** polls every `MONITOR_POLL_MS` (default 15 min), fetches each
   active flight's status via the shared `lib/flights.ts`, and writes
   `lastStatus` / `lastStatusData` / `lastCheckedAt`.
4. On a **material change** (→ cancelled / diverted, or a delay crossing the
   threshold), it sends a **push** (with an **email fallback**), deep-linking the
   traveller into the Disruption Rescue flow. Alerts are throttled per flight.

To keep hosting cheap the monitor can run **inside** the API process
(`ENABLE_MONITOR=1`) instead of as a separate paid worker.

---

## Deploy (Render)

The repo-root `render.yaml` is a Render **Blueprint** that stands up the web API +
a managed Postgres database with almost no manual setup:

- `DATABASE_URL` injected from the managed database automatically.
- `SESSION_SECRET` auto-generated.
- Tables created on deploy via `preDeployCommand`.
- All third-party keys are `sync:false` (dashboard-set) and optional.

**To deploy:** Render → **New + → Blueprint** → select this repo → **Apply**.
Health check: `/api/healthz`.

The app ships as a **PWA** (static web export of the Expo app) and points at the
deployed API base URL via `setBaseUrl`. For native builds, use EAS (`eas build`);
remote push requires a real device / EAS build.

---

## Testing

API logic is covered by `node:test` unit tests
(`artifacts/api-server/test/*.test.ts`) — rights & compensation maths, solar
times, timezone/DST conversion, cost-of-living ordering vs. the World Bank anchor,
the visa requirement normaliser, and the fail-toward-caution advisory override.

```bash
pnpm --filter @workspace/api-server test
```

---

*HOLTO is developed with the assistance of Claude Code.*
