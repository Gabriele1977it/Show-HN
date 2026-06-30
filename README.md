# EchoDeck

**Turn native-language audio into flashcards and shadowing practice.**

A focused study-deck builder for solo creators and small media teams who
produce language-learning content. Paste a transcript of native audio, and
EchoDeck segments it into flashcards and timed *shadowing* loops, schedules
them with spaced repetition, and exports the result to the tools your audience
already uses (Anki, spreadsheets, JSON).

> **Why this exists.** The workflow shows up repeatedly in public discussion
> (e.g. *Show HN: Turn native language audio into flashcards and shadowing
> practice*), but creators stitch it together by hand. EchoDeck is the
> purpose-built tool for that loop: ingest → action queue → export/alert.

---

## Features

- **Ingest** a transcript with timestamps (`[00:12]`, `1:02:33`, bare `00:12`),
  or import a subtitle file (`.srt` / `.vtt`) — cue ranges give every card its
  real start **and** end time. Plain text is split into sentence cards.
- **Shadowing player** — each timestamped card becomes a loop with adjustable
  playback speed (0.6× / 0.75× / 1×) for repeat-after-me practice.
- **Spaced repetition** — an SM-2 scheduler surfaces a daily *due* queue so
  study sessions stay short and effective.
- **Cloze (fill-in-the-blank)** — one click auto-blanks a key term in each
  sentence (longest kanji run / longest word heuristic); review hides the term
  and reveals it highlighted alongside the translation. Terms are editable.
- **Inline editing** — add the translation / meaning to the back of each card.
- **Cross-deck search** — the topbar search box (and `/api/search`) finds any
  card by front/back/notes across every deck, with the match highlighted and a
  one-click jump that scrolls to and flashes the card in its deck.
- **Study dashboard** — a *Stats* tab (and `/api/stats` endpoint) tracks review
  history: cards in study, reviews today, 14-day retention rate, study streak, a
  14-day activity chart, and a 7-day due forecast.
- **Review alerts** — an *Alerts* tab (and `/api/alerts` endpoint) summarises
  how many cards are due across every deck and when the next card comes up, with
  one-click jump straight into a review session. This is the surface a daily
  push/email reminder would hang off.
- **Shareable decks** — publish any deck to an unguessable public link
  (`/s/:shareId`). Your audience gets a read-only viewer (shadowing loops,
  reveal-meaning, export) with no access to your private review schedule; one
  click to unshare revokes it.
- **Export** to Anki (`.tsv`), CSV, or full-fidelity JSON.
- **User accounts** — sign up with email + password (scrypt-hashed) and log in
  from any device to retrieve your workspaces, instead of pasting raw keys. An
  account keeps a keychain of the member keys it can access and a session token
  for account management. Anonymous use still works — accounts are optional.
- **Team workspaces with roles** — every deck lives in a workspace, isolated
  from others. Each member has their own access key and a role: **admin**
  (manage members), **editor** (read + write decks/cards), or **viewer**
  (read-only). Admins invite members from the Workspace panel and get a
  one-time key to hand over. The web client creates a personal workspace
  (as admin) automatically on first visit.
- **Zero external services** — runs locally with a single JSON data file; no
  database server, no third-party auth.

## Quick start

```bash
npm install
npm start          # http://localhost:3000
```

Open the app, paste a transcript on the **Build** tab, optionally attach an
audio file (or paste a URL), and click **Build deck**. Switch to **Study** to
review due cards and run shadowing loops.

```bash
npm test           # run the test suite (node:test, no extra tooling)
npm run dev        # auto-restart on file changes
```

## How segmentation works

| Input | Result |
|-------|--------|
| SRT / WebVTT cues (`00:00:01,000 --> 00:00:04,000`) | One card per cue with the real start **and** end time. Index lines, the `WEBVTT` header, `NOTE` blocks, and cue settings are ignored. |
| `[00:00] こんにちは` / `[00:04] …` | One card per line; each card's end = next card's start (used for the shadowing loop). |
| `00:00 hello` (bare timestamp) | Same as above. |
| Plain paragraph text | Split on sentence punctuation (incl. CJK `。！？`), packed into cards up to *Max card length* characters. |
| Lines with no leading timestamp after a timed cue | Appended to the previous cue. |

Use the **Import .srt / .vtt** button on the Build tab to load a subtitle file
straight into the transcript box.

## API

The web UI is a thin client over a small REST API. **Every `/api` route is
workspace-scoped** and requires an `Authorization: Bearer <member-key>` header —
the only exceptions are `POST /api/workspaces` (bootstrap) and the public
`/api/shared/...` endpoints. Viewers may only call `GET`; member management is
admin-only.

Account endpoints use a session token in an `X-Session` header (kept separate
from the workspace member key in `Authorization`).

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/signup` | Create an account `{email,password}`; makes a workspace, returns a session `token` + keychain. |
| `POST` | `/api/auth/login` | Log in; returns a session `token` and the account keychain. |
| `POST` | `/api/auth/logout` | Invalidate the current session (`X-Session`). |
| `GET` | `/api/account` | The signed-in account's email + keychain (`X-Session`). |
| `POST` | `/api/account/keys` | Save a member key to the account keychain. |
| `POST` | `/api/workspaces` | Create a workspace; returns `id`, `name`, your admin `key`, and `role`. No auth. |
| `GET` | `/api/workspace` | Identify the current workspace and the caller's role. |
| `GET` | `/api/members` | List members (no keys). |
| `POST` | `/api/members` | (admin) Invite a member `{name, role}`; returns the new key once. |
| `DELETE` | `/api/members/:id` | (admin) Revoke a member (cannot remove the last admin). |
| `POST` | `/api/decks` | Create a deck from `{ title, language, audioUrl, transcript, maxChars }`. |
| `GET` | `/api/decks` | List decks with card and due counts. |
| `GET` | `/api/alerts` | Cross-deck review summary: `totalDue`, per-deck due counts, and the next due time. |
| `GET` | `/api/stats` | Study dashboard data: totals, retention, streak, 14-day activity, 7-day due forecast. |
| `GET` | `/api/search?q=…&limit=…` | Cross-deck card search (front/back/notes), with deck context. |
| `GET` | `/api/reminders/preview` | The reminder message that would be sent now, plus whether it would fire. |
| `POST` | `/api/reminders/test` | Force-send a reminder now (ignores the throttle). |
| `GET` | `/api/decks/:id` | Deck with all cards. |
| `DELETE` | `/api/decks/:id` | Delete a deck and its cards. |
| `POST` | `/api/decks/:id/cards` | Append more cards from extra transcript text. |
| `POST` | `/api/decks/:id/cloze` | Auto-generate cloze terms (`{overwrite?}`); returns updated count + deck. |
| `GET` | `/api/decks/:id/due` | Cards due for review now. |
| `GET` | `/api/decks/:id/export?format=anki\|csv\|json` | Download the deck. |
| `PATCH` | `/api/cards/:id` | Update `front` / `back` / `notes` / `tags` / timing. |
| `POST` | `/api/cards/:id/review` | Grade a card (`again`/`hard`/`good`/`easy` or `0`–`5`). |
| `POST` | `/api/decks/:id/share` | Publish to a public link; returns `shareId` + `shareUrl`. |
| `DELETE` | `/api/decks/:id/share` | Unpublish (revoke the link). |
| `GET` | `/api/shared/:shareId` | Public read-only deck (card content only). |
| `GET` | `/api/shared/:shareId/export?format=…` | Export a shared deck. |
| `GET` | `/s/:shareId` | Public viewer page for a shared deck. |
| `POST` | `/api/upload` | Upload an audio file (multipart field `audio`). |

## Reminders (push / email)

EchoDeck can nudge you when cards are due. The summary from `/api/alerts` is
formatted into a message and delivered through a single outbound **webhook**, so
one mechanism covers push, chat, and email without baking in any provider
credentials:

- **Push to phone** — point `REMINDER_WEBHOOK_URL` at an [ntfy.sh](https://ntfy.sh) topic.
- **Chat** — a Slack or Discord incoming webhook URL.
- **Email** — a relay such as Zapier / Make / Mailgun that turns the POST into an email.

When no webhook is set, reminders are logged to the console so the surface is
always inspectable. Sends are throttled **per workspace** (at most once per
`REMINDER_MIN_INTERVAL_MS`, default 12h) and only fire when at least
`REMINDER_MIN_DUE` cards are due. Set `REMINDER_ENABLED=1` to turn on background
polling (which checks every workspace); the **Alerts** tab can also preview and
force-send a test at any time.

## Configuration

| Env var | Default | Meaning |
|---------|---------|---------|
| `PORT` | `3000` | HTTP port. |
| `ECHODECK_DATA` | `./data/db.json` | Path to the JSON data file. |
| `ECHODECK_UPLOADS` | `./uploads` | Directory for uploaded audio. |
| `REMINDER_WEBHOOK_URL` | _(unset)_ | Outbound webhook for reminders (ntfy / Slack / Discord / email relay). Logs to console if unset. |
| `REMINDER_ENABLED` | `0` | Set to `1`/`true` to run background reminder polling. |
| `REMINDER_MIN_DUE` | `1` | Minimum due cards before a reminder fires. |
| `REMINDER_MIN_INTERVAL_MS` | `43200000` | Minimum gap between reminders (12h). |
| `REMINDER_POLL_MS` | `1800000` | Background poll interval (30m). |

## Project layout

```
server/
  index.js       entry point (listener + config)
  app.js         express app factory + routes
  store.js       atomic JSON persistence
  segment.js     transcript → segments
  srs.js         SM-2 spaced repetition
  cloze.js       fill-in-the-blank term suggestion + masking
  auth.js        password hashing (scrypt) + session tokens
  exporters.js   Anki / CSV / JSON exporters
  reminders.js   due-review reminders + webhook delivery
  stats.js       study dashboard aggregation (history, streak, forecast)
public/          single-page web client + share.html public viewer
test/            node:test suites
```

## Roadmap (post-MVP)

- Auto-transcription of uploaded audio (Whisper-class model) so creators can
  skip the manual transcript step.
- SSO / OAuth sign-in and password reset on top of the accounts layer.
- Per-user / per-deck reminder schedules and quiet hours (current reminders are
  a single global webhook).

## Validation notes

These are explicitly **unconfirmed** and should be checked before investing:

- **Competition** — no dominant purpose-built tool was evident in the source
  records, but run manual competitor validation before building further.
- **Pricing** — a subscription / usage model is plausible for this audience; no
  revenue figures are claimed here.
