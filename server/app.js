// EchoDeck HTTP app factory.
//
// Kept separate from the listener (index.js) so tests can mount the app
// against an in-memory / temp-file store without binding a port.

import express from "express";
import multer from "multer";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { nanoid } from "nanoid";
import { segmentTranscript } from "./segment.js";
import { exportDeck } from "./exporters.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const GRADE_MAP = { again: 2, hard: 3, good: 4, easy: 5 };

export function createApp({ store, uploadsDir, reminders }) {
  const app = express();
  app.use(express.json({ limit: "4mb" }));

  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadsDir,
      filename: (_req, file, cb) => {
        const safe = extname(file.originalname || "").toLowerCase().replace(/[^.a-z0-9]/g, "");
        cb(null, `${nanoid(12)}${safe || ".bin"}`);
      },
    }),
    limits: { fileSize: 60 * 1024 * 1024 }, // 60 MB
    fileFilter: (_req, file, cb) => cb(null, /^audio\//.test(file.mimetype)),
  });

  // --- audio upload ----------------------------------------------------
  app.post("/api/upload", upload.single("audio"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No audio file (field 'audio') accepted." });
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  // --- decks -----------------------------------------------------------
  app.post("/api/decks", (req, res) => {
    const { title, language, audioUrl, transcript, maxChars } = req.body ?? {};
    const deck = store.createDeck({ title, language, audioUrl });
    const segments = segmentTranscript(transcript ?? "", { maxChars: Number(maxChars) || undefined });
    const cards = store.addCards(deck.id, segments);
    res.status(201).json({ ...store.getDeck(deck.id), cards });
  });

  app.get("/api/decks", (_req, res) => {
    res.json(store.listDecks());
  });

  // Cross-deck review alert (drives the Alerts tab and any future push/email).
  app.get("/api/alerts", (_req, res) => {
    res.json(store.dueSummary());
  });

  // Study statistics for the dashboard.
  app.get("/api/stats", (_req, res) => {
    res.json(store.stats());
  });

  // --- reminders -------------------------------------------------------
  // Preview what a reminder would say and whether one would fire right now.
  app.get("/api/reminders/preview", (_req, res) => {
    if (!reminders) return res.json({ enabled: false });
    res.json({ enabled: true, ...reminders.preview() });
  });

  // Force-send a reminder now (ignores the de-dupe gate). Used by the UI's
  // "Send test reminder" button and for ops verification.
  app.post("/api/reminders/test", async (_req, res) => {
    if (!reminders) return res.status(400).json({ error: "Reminders are not configured." });
    try {
      const result = await reminders.run({ force: true });
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: `Reminder delivery failed: ${err.message}` });
    }
  });

  app.get("/api/decks/:id", (req, res) => {
    const deck = store.getDeck(req.params.id);
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    res.json(deck);
  });

  app.delete("/api/decks/:id", (req, res) => {
    if (!store.deleteDeck(req.params.id)) return res.status(404).json({ error: "Deck not found" });
    res.status(204).end();
  });

  // Append more cards from additional transcript text.
  app.post("/api/decks/:id/cards", (req, res) => {
    const deck = store.getDeck(req.params.id);
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    const { transcript, maxChars } = req.body ?? {};
    const segments = segmentTranscript(transcript ?? "", { maxChars: Number(maxChars) || undefined });
    const cards = store.addCards(deck.id, segments);
    res.status(201).json(cards);
  });

  app.get("/api/decks/:id/due", (req, res) => {
    const deck = store.getDeck(req.params.id);
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    res.json(store.dueCards(req.params.id));
  });

  app.get("/api/decks/:id/export", (req, res) => {
    const deck = store.getDeck(req.params.id);
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    const { body, type, ext } = exportDeck(deck, deck.cards, req.query.format);
    const safeName = (deck.title || "deck").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60) || "deck";
    res.setHeader("Content-Type", type + "; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.${ext}"`);
    res.send(body);
  });

  // --- cards -----------------------------------------------------------
  app.patch("/api/cards/:id", (req, res) => {
    const card = store.updateCard(req.params.id, req.body ?? {});
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  });

  app.delete("/api/cards/:id", (req, res) => {
    if (!store.deleteCard(req.params.id)) return res.status(404).json({ error: "Card not found" });
    res.status(204).end();
  });

  app.post("/api/cards/:id/review", (req, res) => {
    let { grade } = req.body ?? {};
    if (typeof grade === "string") grade = GRADE_MAP[grade.toLowerCase()] ?? Number(grade);
    if (typeof grade !== "number" || Number.isNaN(grade)) {
      return res.status(400).json({ error: "grade must be 0-5 or one of again/hard/good/easy" });
    }
    const card = store.reviewCard(req.params.id, grade);
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  });

  // --- static ----------------------------------------------------------
  app.use("/uploads", express.static(uploadsDir));
  app.use(express.static(PUBLIC_DIR));
  app.get("/health", (_req, res) => res.json({ ok: true }));

  return app;
}
