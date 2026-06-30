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
- **Inline editing** — add the translation / meaning to the back of each card.
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
- **Zero external services** — runs locally with a single JSON data file; no
  API keys, no database server.

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

The web UI is a thin client over a small REST API:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/decks` | Create a deck from `{ title, language, audioUrl, transcript, maxChars }`. |
| `GET` | `/api/decks` | List decks with card and due counts. |
| `GET` | `/api/alerts` | Cross-deck review summary: `totalDue`, per-deck due counts, and the next due time. |
| `GET` | `/api/stats` | Study dashboard data: totals, retention, streak, 14-day activity, 7-day due forecast. |
| `GET` | `/api/reminders/preview` | The reminder message that would be sent now, plus whether it would fire. |
| `POST` | `/api/reminders/test` | Force-send a reminder now (ignores the throttle). |
| `GET` | `/api/decks/:id` | Deck with all cards. |
| `DELETE` | `/api/decks/:id` | Delete a deck and its cards. |
| `POST` | `/api/decks/:id/cards` | Append more cards from extra transcript text. |
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
always inspectable. Sends are throttled (at most once per `REMINDER_MIN_INTERVAL_MS`,
default 12h) and only fire when at least `REMINDER_MIN_DUE` cards are due. Set
`REMINDER_ENABLED=1` to turn on background polling; the **Alerts** tab can also
preview and force-send a test at any time.

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
  exporters.js   Anki / CSV / JSON exporters
  reminders.js   due-review reminders + webhook delivery
  stats.js       study dashboard aggregation (history, streak, forecast)
public/          single-page web client + share.html public viewer
test/            node:test suites
```

## Roadmap (post-MVP)

- Auto-transcription of uploaded audio (Whisper-class model) so creators can
  skip the manual transcript step.
- Cross-deck search and cloze (fill-in-the-blank) card generation.
- Team workspaces and accounts (sharing today is per-deck, unlisted links).
- Per-user / per-deck reminder schedules and quiet hours (current reminders are
  a single global webhook).

## Validation notes

These are explicitly **unconfirmed** and should be checked before investing:

- **Competition** — no dominant purpose-built tool was evident in the source
  records, but run manual competitor validation before building further.
- **Pricing** — a subscription / usage model is plausible for this audience; no
  revenue figures are claimed here.
