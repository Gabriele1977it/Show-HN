# HOLTO — end-to-end / visual smoke tests

Playwright tests that load HOLTO's key pages in a real browser, fail on any
uncaught JS/console error, and diff each page against a saved screenshot. This is
the "catch silent breakage" net: it flags UI that quietly broke even when a page
still *looks* roughly right.

> This folder is **standalone** — it has its own `package.json` and is **not**
> part of the pnpm workspace, so installing Playwright here can never disturb the
> app or API dependency trees.

## Run it

```bash
cd holto/e2e
npm install
npx playwright install chromium      # one-time: download the browser
npm test
```

By default it points at the live PWA (`https://app.holtotravel.com`). Override:

```bash
E2E_BASE_URL=https://your-preview.onrender.com npm test
E2E_MARKETING_URL=https://holtotravel.com npm test
```

## What it checks

- **App shell / sign-in** and the **marketing landing page** load, show HOLTO
  branding, and produce **zero console/page errors**.
- A **screenshot** of each page is compared to a stored baseline.

### Signed-in pages (optional)

Set a **dedicated test account's** credentials to also check the logged-in key
pages (home, cost of living, visa, travel alerts, currency):

```bash
E2E_EMAIL=test@holtotravel.com E2E_PASSWORD=•••••• npm test
```

If the sign-in form's fields change, adjust the selectors in
`tests/smoke.spec.ts` (they're intentionally forgiving).

## Baselines

The **first run writes** the reference screenshots (under
`tests/smoke.spec.ts-snapshots/`). Commit them. Later runs **diff** against them
and fail on a meaningful visual change. When a change is intentional, refresh the
baselines:

```bash
npm run test:update
```

## In CI

Add a job that runs `npm ci && npx playwright install --with-deps chromium &&
npm test` in this folder against your deploy preview. Screenshots + traces for
failures land in `playwright-report/`.
