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
| `GET` | `/api/decks/:id` | Deck with all cards. |
| `DELETE` | `/api/decks/:id` | Delete a deck and its cards. |
| `POST` | `/api/decks/:id/cards` | Append more cards from extra transcript text. |
| `GET` | `/api/decks/:id/due` | Cards due for review now. |
| `GET` | `/api/decks/:id/export?format=anki\|csv\|json` | Download the deck. |
| `PATCH` | `/api/cards/:id` | Update `front` / `back` / `notes` / `tags` / timing. |
| `POST` | `/api/cards/:id/review` | Grade a card (`again`/`hard`/`good`/`easy` or `0`–`5`). |
| `POST` | `/api/upload` | Upload an audio file (multipart field `audio`). |

## Configuration

| Env var | Default | Meaning |
|---------|---------|---------|
| `PORT` | `3000` | HTTP port. |
| `ECHODECK_DATA` | `./data/db.json` | Path to the JSON data file. |
| `ECHODECK_UPLOADS` | `./uploads` | Directory for uploaded audio. |

## Project layout

```
server/
  index.js       entry point (listener + config)
  app.js         express app factory + routes
  store.js       atomic JSON persistence
  segment.js     transcript → segments
  srs.js         SM-2 spaced repetition
  exporters.js   Anki / CSV / JSON exporters
public/          single-page web client (no build step)
test/            node:test suites
```

## Roadmap (post-MVP)

- Auto-transcription of uploaded audio (Whisper-class model) so creators can
  skip the manual transcript step.
- Team workspaces and shareable read-only decks.
- Email / push alerts when a deck has cards due (mobile-first surface).

## Validation notes

These are explicitly **unconfirmed** and should be checked before investing:

- **Competition** — no dominant purpose-built tool was evident in the source
  records, but run manual competitor validation before building further.
- **Pricing** — a subscription / usage model is plausible for this audience; no
  revenue figures are claimed here.
