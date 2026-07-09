# HOLTO

An honest travel-disruption companion: when a flight is delayed or cancelled it
explains the traveller's UK261 / EU261 passenger rights in plain English, gives a
calm step-by-step checklist, and proactively monitors the flight — pushing an
alert the moment its status changes.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/api-server run dev:worker` — run the flight-monitoring worker
- `pnpm --filter holto run start` — run the Expo app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY`, `AIRLABS_API_KEY` (see `README.md`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- App: Expo / React Native (Expo Router)

## Where things live

- App (Expo): `artifacts/holto` — screens in `app/`, `(tabs)/` for the tab bar
- API: `artifacts/api-server/src` — `routes/` (Express routers), `lib/` (shared logic)
- Worker: `artifacts/api-server/src/worker.ts` — background flight poller + alert delivery (second entry point of the API package)
- DB schema (source of truth): `lib/db/src/schema`
- API contract (source of truth): `lib/api-spec/openapi.yaml` → generates `lib/api-zod` + `lib/api-client-react`

## Architecture decisions

- **Proactive monitoring lives in a dedicated worker**, not the request path: the
  API is stateless/request-scoped, and a separate long-running worker process
  (`artifacts/api-server/src/worker.ts`) polls flights and sends alerts so
  notifications fire even when no client is connected.
- **Flight-status logic is shared** via `artifacts/api-server/src/lib/flights.ts`
  so the `/flights/status` route and the worker use one implementation.
- **Push + email fallback**: alerts go out as Expo push notifications, falling back
  to email when a user has no registered push token, so no monitored user is missed.
- **Host-agnostic config**: the public URL and CORS come from `PUBLIC_URL` /
  `APP_ORIGIN` / `ALLOWED_ORIGINS` env vars (Replit's `REPLIT_DOMAINS` is only a
  fallback), so HOLTO runs on any host.

## Product

- **Disruption Rescue** — guided report of a delay/cancellation → AI companion
  returns likely rights, ordered actions, and a tickable checklist.
- **Rights / EU261 calculator** — deterministic distance-based compensation tiers.
- **My Flight** — track a flight; the worker watches it and pushes status changes.
- **Living** — cost-of-living comparison, the entry point to the wider "live abroad"
  journey.
- Accounts (JWT), Stripe plans (Free / Trip Pass / Pro).

## Gotchas

- Always regenerate the client after editing `lib/api-spec/openapi.yaml`
  (`pnpm --filter @workspace/api-spec run codegen`) — routes and Zod schemas are generated.
- The worker and API both need `DATABASE_URL`, `OPENAI_API_KEY`, and `AIRLABS_API_KEY`.
- Native push requires an EAS build / real device; Expo Go won't reliably receive remote push.

## Pointers

- See `README.md` for full env + deploy instructions (`holto/render.yaml` Blueprint).
- See the `pnpm-workspace` skill for workspace structure and package details.
