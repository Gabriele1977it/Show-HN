# Going live on madlabs.uk

This repo deploys two services (see `render.yaml`):

| Service | What | Domain | Render plan |
|---|---|---|---|
| `madlabs-hub` | The MadLabs company site (`madlabs/`, static) | `madlabs.uk` + `www.madlabs.uk` | Free (static) |
| `echodeck` | The EchoDeck app (Node + persistent disk) | `echodeck.madlabs.uk` | Starter+ (needs the disk) |

## 1. Merge to `main`
The blueprint deploys from `main`. Merge the feature branch first (open a PR → merge),
so production tracks `main`.

## 2. Create the services (Render Blueprint)
1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Blueprint**.
2. Connect this GitHub repo. Render reads `render.yaml` and proposes both services.
3. Apply. `echodeck` provisions a 1 GB persistent disk at `/data` (SQLite DB + uploads);
   `madlabs-hub` is a free static site.

## 3. Custom domains
Add domains in each service's **Settings → Custom Domains**, then create the DNS
records your registrar shows (Render gives you the exact targets):

| Host | Record | Points to |
|---|---|---|
| `madlabs.uk` (apex) | `ALIAS`/`ANAME` (or the A record Render shows) | `madlabs-hub` |
| `www.madlabs.uk` | `CNAME` | `madlabs-hub` |
| `echodeck.madlabs.uk` | `CNAME` | `echodeck` |

TLS certs are issued automatically once DNS resolves. If your registrar can't do
`ALIAS`/`ANAME` at the apex, redirect the apex to `www` (or use Render's provided A record).

## 4. EchoDeck environment variables (Render dashboard → echodeck → Environment)
All optional — each feature is hidden/disabled until its key is set:

| Var | For |
|---|---|
| `ANTHROPIC_API_KEY` (+ optional `ECHODECK_LLM_MODEL`) | AI card-back fill |
| `TRANSCRIBE_WEBHOOK_URL` | Auto-transcription (point at a Whisper/Deepgram/AssemblyAI relay) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push — generate once: `npx web-push generate-vapid-keys` |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`, `STRIPE_WEBHOOK_SECRET` | Real billing (else dev mode) |
| `EMAIL_WEBHOOK_URL` | Password-reset emails |
| `OWNER_EMAILS` | Comma-separated emails auto-comped to Team |
| `REMINDER_WEBHOOK_URL`, `REMINDER_ENABLED=1` | Daily due-review reminders (also fans out to Web Push) |

## 5. Stripe webhook (only if using real billing)
Point a Stripe webhook at `https://echodeck.madlabs.uk/api/billing/webhook`
(events: `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`) and put its signing secret in `STRIPE_WEBHOOK_SECRET`.

## 6. Verify
- `https://madlabs.uk` → company hub, "Visit EchoDeck" links to the app.
- `https://echodeck.madlabs.uk/health` → `{"ok":true}`.
- App logs show which optional features are enabled (`AI card fill enabled`,
  `Auto-transcription enabled`, `Web Push enabled`, …).

> **Splitting later:** the hub currently lives in this repo under `madlabs/` for
> speed. When you add more products, move it to its own `madlabs-hub` repo and
> point the static service at that instead — nothing else changes.
