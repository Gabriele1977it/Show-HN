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

function sendExport(res, deck, cards, format) {
  const { body, type, ext } = exportDeck(deck, cards, format);
  const safeName = (deck.title || "deck").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60) || "deck";
  res.setHeader("Content-Type", type + "; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.${ext}"`);
  res.send(body);
}

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

  // --- auth ------------------------------------------------------------
  // Every /api route is workspace-scoped, except creating a workspace and the
  // public shared-deck endpoints. The caller proves membership with the
  // workspace key (Authorization: Bearer <key>).
  app.use("/api", (req, res, next) => {
    if (req.method === "POST" && req.path === "/workspaces") return next();
    if (req.path.startsWith("/shared/")) return next();
    const key = (req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const ws = store.getWorkspaceByKey(key);
    if (!ws) return res.status(401).json({ error: "Missing or invalid workspace key." });
    req.ws = ws.id;
    next();
  });

  // --- workspaces ------------------------------------------------------
  // Create a workspace and receive its access key (show once, store client-side).
  app.post("/api/workspaces", (req, res) => {
    const ws = store.createWorkspace({ name: req.body?.name });
    res.status(201).json({ id: ws.id, name: ws.name, key: ws.key });
  });

  // Identify the current workspace (validates the key).
  app.get("/api/workspace", (req, res) => {
    res.json(store.getWorkspace(req.ws));
  });

  // --- audio upload ----------------------------------------------------
  app.post("/api/upload", upload.single("audio"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No audio file (field 'audio') accepted." });
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  // --- decks -----------------------------------------------------------
  app.post("/api/decks", (req, res) => {
    const { title, language, audioUrl, transcript, maxChars } = req.body ?? {};
    const deck = store.createDeck(req.ws, { title, language, audioUrl });
    const segments = segmentTranscript(transcript ?? "", { maxChars: Number(maxChars) || undefined });
    const cards = store.addCards(deck.id, segments, req.ws);
    res.status(201).json({ ...store.getDeck(deck.id, req.ws), cards });
  });

  app.get("/api/decks", (req, res) => {
    res.json(store.listDecks(req.ws));
  });

  // Cross-deck review alert (drives the Alerts tab and any future push/email).
  app.get("/api/alerts", (req, res) => {
    res.json(store.dueSummary(req.ws));
  });

  // Study statistics for the dashboard.
  app.get("/api/stats", (req, res) => {
    res.json(store.stats(req.ws));
  });

  // Cross-deck card search.
  app.get("/api/search", (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    res.json(store.searchCards(req.ws, req.query.q ?? "", limit));
  });

  // --- reminders -------------------------------------------------------
  // Preview what a reminder would say and whether one would fire right now.
  app.get("/api/reminders/preview", (req, res) => {
    if (!reminders) return res.json({ enabled: false });
    res.json({ enabled: true, ...reminders.preview(req.ws) });
  });

  // Force-send a reminder now (ignores the de-dupe gate). Used by the UI's
  // "Send test reminder" button and for ops verification.
  app.post("/api/reminders/test", async (req, res) => {
    if (!reminders) return res.status(400).json({ error: "Reminders are not configured." });
    try {
      const result = await reminders.run({ workspaceId: req.ws, force: true });
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: `Reminder delivery failed: ${err.message}` });
    }
  });

  app.get("/api/decks/:id", (req, res) => {
    const deck = store.getDeck(req.params.id, req.ws);
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    res.json(deck);
  });

  app.delete("/api/decks/:id", (req, res) => {
    if (!store.deleteDeck(req.params.id, req.ws)) return res.status(404).json({ error: "Deck not found" });
    res.status(204).end();
  });

  // Append more cards from additional transcript text.
  app.post("/api/decks/:id/cards", (req, res) => {
    const { transcript, maxChars } = req.body ?? {};
    const segments = segmentTranscript(transcript ?? "", { maxChars: Number(maxChars) || undefined });
    const cards = store.addCards(req.params.id, segments, req.ws);
    if (cards === null) return res.status(404).json({ error: "Deck not found" });
    res.status(201).json(cards);
  });

  // Auto-generate fill-in-the-blank (cloze) terms for the deck's cards.
  app.post("/api/decks/:id/cloze", (req, res) => {
    const overwrite = req.body?.overwrite === true;
    const result = store.generateClozeForDeck(req.params.id, req.ws, { overwrite });
    if (!result) return res.status(404).json({ error: "Deck not found" });
    res.json({ ...result, deck: store.getDeck(req.params.id, req.ws) });
  });

  app.get("/api/decks/:id/due", (req, res) => {
    const due = store.dueCards(req.params.id, req.ws);
    if (due === null) return res.status(404).json({ error: "Deck not found" });
    res.json(due);
  });

  app.get("/api/decks/:id/export", (req, res) => {
    const deck = store.getDeck(req.params.id, req.ws);
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    sendExport(res, deck, deck.cards, req.query.format);
  });

  // --- sharing ---------------------------------------------------------
  // Publish a deck to an unguessable public link (or return the existing one).
  app.post("/api/decks/:id/share", (req, res) => {
    const deck = store.publishDeck(req.params.id, req.ws);
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    res.json({ shareId: deck.shareId, shareUrl: `${req.protocol}://${req.get("host")}/s/${deck.shareId}` });
  });

  app.delete("/api/decks/:id/share", (req, res) => {
    const deck = store.unpublishDeck(req.params.id, req.ws);
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    res.status(204).end();
  });

  // Public, read-only deck data (no private scheduling state).
  app.get("/api/shared/:shareId", (req, res) => {
    const deck = store.getSharedDeck(req.params.shareId);
    if (!deck) return res.status(404).json({ error: "Shared deck not found" });
    res.json(deck);
  });

  app.get("/api/shared/:shareId/export", (req, res) => {
    const deck = store.getSharedDeck(req.params.shareId);
    if (!deck) return res.status(404).json({ error: "Shared deck not found" });
    sendExport(res, deck, deck.cards, req.query.format);
  });

  // Public viewer page.
  app.get("/s/:shareId", (_req, res) => res.sendFile(join(PUBLIC_DIR, "share.html")));

  // --- cards -----------------------------------------------------------
  app.patch("/api/cards/:id", (req, res) => {
    const card = store.updateCard(req.params.id, req.body ?? {}, req.ws);
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  });

  app.delete("/api/cards/:id", (req, res) => {
    if (!store.deleteCard(req.params.id, req.ws)) return res.status(404).json({ error: "Card not found" });
    res.status(204).end();
  });

  app.post("/api/cards/:id/review", (req, res) => {
    let { grade } = req.body ?? {};
    if (typeof grade === "string") grade = GRADE_MAP[grade.toLowerCase()] ?? Number(grade);
    if (typeof grade !== "number" || Number.isNaN(grade)) {
      return res.status(400).json({ error: "grade must be 0-5 or one of again/hard/good/easy" });
    }
    const card = store.reviewCard(req.params.id, grade, req.ws);
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  });

  // --- static ----------------------------------------------------------
  app.use("/uploads", express.static(uploadsDir));
  app.use(express.static(PUBLIC_DIR));
  app.get("/health", (_req, res) => res.json({ ok: true }));

  return app;
}
