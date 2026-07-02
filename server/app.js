// EchoDeck HTTP app factory.
//
// Kept separate from the listener (index.js) so tests can mount the app
// against an in-memory / temp-file store without binding a port.

import express from "express";
import multer from "multer";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { nanoid } from "nanoid";
import { segmentTranscript } from "./segment.js";
import { suggestCloze, applyCloze } from "./cloze.js";
import { scoreAttempt } from "./pronounce.js";
import { deliverToWorkspace } from "./push.js";
import { exportDeck } from "./exporters.js";
import { normalizeEmail } from "./auth.js";
import { canAdd, hasFeature, planPublic, listPlans } from "./plans.js";
import { createRateLimiter, rateLimit, securityHeaders } from "./security.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const GRADE_MAP = { again: 2, hard: 3, good: 4, easy: 5 };

// Minimal HTML-attribute escaping for server-rendered SEO tags.
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Build a <title> + description + OpenGraph/Twitter block for a page. Injected
// server-side so crawlers and social unfurls see per-deck metadata even though
// the page itself is a JS-rendered SPA.
function seoTags({ title, description, url, image }) {
  const t = escapeHtml(title), d = escapeHtml(description), u = escapeHtml(url), img = escapeHtml(image);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${u}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${u}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${img}" />`,
  ].join("\n    ");
}

function sendExport(res, deck, cards, format) {
  const { body, type, ext } = exportDeck(deck, cards, format);
  const safeName = (deck.title || "deck").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60) || "deck";
  res.setHeader("Content-Type", type + "; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.${ext}"`);
  res.send(body);
}

export function createApp({ store, uploadsDir, reminders, billing, mailer, enrich, transcribe, importer, push, ownerEmails = new Set(), rateLimits = {} }) {
  const app = express();
  app.set("trust proxy", 1); // behind a host's load balancer; lets req.ip work
  app.use(securityHeaders);
  // Throttle auth endpoints to blunt credential stuffing / signup spam.
  const authLimiter = rateLimit(createRateLimiter(rateLimits.auth ?? { windowMs: 15 * 60 * 1000, max: 40 }));
  // The public no-signup demo runs without a workspace key, so throttle it per
  // IP to keep it from being used as free, unauthenticated compute.
  const demoLimiter = rateLimit(createRateLimiter(rateLimits.demo ?? { windowMs: 15 * 60 * 1000, max: 60 }));
  // URL/YouTube import makes an outbound fetch per call, so throttle it per IP.
  const importLimiter = rateLimit(createRateLimiter(rateLimits.import ?? { windowMs: 15 * 60 * 1000, max: 30 }));
  // Owner allowlist: these accounts get the top (Team) plan automatically.
  const isOwner = (email) => Boolean(email) && ownerEmails.has(String(email).toLowerCase());
  const compOwnerWorkspaces = (userId) => {
    for (const k of store.getAccount(userId)?.keychain ?? []) store.setWorkspacePlan(k.workspaceId, "team");
  };
  // Stripe webhooks need the raw body for signature verification, so skip JSON
  // parsing on that one route.
  app.use((req, res, next) =>
    req.path === "/api/billing/webhook" ? next() : express.json({ limit: "4mb" })(req, res, next));

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
    // The no-signup demo (build cards / score a shadow attempt) is public.
    if (req.path.startsWith("/demo/")) return next();
    // The marketplace catalog is public (browse without a key); installing a
    // listed deck is a POST and still requires a workspace key.
    if (req.method === "GET" && req.path.startsWith("/marketplace")) return next();
    if (req.path.startsWith("/auth/") || req.path.startsWith("/account")) return next();
    if (req.path === "/billing/webhook" || req.path === "/plans") return next();
    const key = (req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const member = store.getMemberByKey(key);
    if (!member) return res.status(401).json({ error: "Missing or invalid workspace key." });
    req.ws = member.workspaceId;
    req.role = member.role;
    req.memberId = member.memberId;
    // Viewers get read-only access to everything.
    if (req.role === "viewer" && req.method !== "GET") {
      return res.status(403).json({ error: "Your role (viewer) is read-only." });
    }
    next();
  });

  // Guard for admin-only routes (member management).
  const requireAdmin = (req, res, next) =>
    req.role === "admin" ? next() : res.status(403).json({ error: "Admin role required." });

  // --- accounts --------------------------------------------------------
  // Session is carried in an X-Session header (kept distinct from the
  // workspace member key in Authorization).
  const sessionUser = (req) => store.getUserBySession((req.get("x-session") || "").trim());

  app.post("/api/auth/signup", authLimiter, (req, res) => {
    const { email, password } = req.body ?? {};
    if (!normalizeEmail(email)) return res.status(400).json({ error: "Enter a valid email." });
    if (!password || String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    const created = store.createUser({ email, password });
    if (created.error === "exists") return res.status(409).json({ error: "An account with that email already exists." });
    // Give the new account a personal workspace and remember its key.
    const ws = store.createWorkspace({ name: `${created.email.split("@")[0]}'s workspace` });
    store.addKeyToAccount(created.id, ws.key);
    if (isOwner(created.email)) store.setWorkspacePlan(ws.id, "team"); // comp owner accounts
    const token = store.createSession(created.id);
    res.status(201).json({ token, email: created.email, key: ws.key, account: store.getAccount(created.id) });
  });

  app.post("/api/auth/login", authLimiter, (req, res) => {
    const { email, password } = req.body ?? {};
    const user = store.authenticateUser(email, password);
    if (!user) return res.status(401).json({ error: "Wrong email or password." });
    if (isOwner(user.email)) compOwnerWorkspaces(user.id); // keep owner workspaces on Team
    const token = store.createSession(user.id);
    res.json({ token, email: user.email, account: store.getAccount(user.id) });
  });

  app.post("/api/auth/logout", (req, res) => {
    store.deleteSession((req.get("x-session") || "").trim());
    res.status(204).end();
  });

  // Request a password-reset link. Always responds the same way so the endpoint
  // can't be used to discover which emails have accounts.
  app.post("/api/auth/request-reset", authLimiter, async (req, res) => {
    const email = req.body?.email;
    const reset = normalizeEmail(email) ? store.createPasswordReset(email) : null;
    const response = { ok: true };
    if (reset) {
      const link = `${req.protocol}://${req.get("host")}/reset?token=${reset.token}`;
      const text = `Reset your EchoDeck password:\n\n${link}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`;
      try {
        await mailer?.send({ to: reset.email, subject: "Reset your EchoDeck password", text, html: `<p><a href="${link}">Reset your EchoDeck password</a> (expires in 1 hour).</p>` });
      } catch (err) {
        console.error("[reset] email failed:", err.message);
      }
      // In dev (no email provider) hand the link back so the flow is testable.
      if (!mailer?.enabled) response.devLink = link;
    }
    res.json(response);
  });

  app.post("/api/auth/reset", authLimiter, (req, res) => {
    const { token, password } = req.body ?? {};
    if (!password || String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    const result = store.resetPassword(token, password);
    if (result.error) return res.status(400).json({ error: "This reset link is invalid or has expired." });
    res.json({ ok: true });
  });

  app.get("/api/account", (req, res) => {
    const user = sessionUser(req);
    if (!user) return res.status(401).json({ error: "Not signed in." });
    res.json(store.getAccount(user.id));
  });

  // Save the member key the client is currently using to the account keychain.
  app.post("/api/account/keys", (req, res) => {
    const user = sessionUser(req);
    if (!user) return res.status(401).json({ error: "Not signed in." });
    const result = store.addKeyToAccount(user.id, req.body?.memberKey);
    if (result.error) return res.status(400).json({ error: "Invalid member key." });
    res.json(store.getAccount(user.id));
  });

  // --- workspaces ------------------------------------------------------
  // Create a workspace and receive your admin access key (show once, store client-side).
  app.post("/api/workspaces", (req, res) => {
    const ws = store.createWorkspace({ name: req.body?.name });
    const u = sessionUser(req);
    if (u && isOwner(u.email)) store.setWorkspacePlan(ws.id, "team"); // owner's new workspaces are comped
    res.status(201).json({ id: ws.id, name: ws.name, key: ws.key, role: ws.role });
  });

  // Identify the current workspace, the caller's role, and the plan + usage.
  app.get("/api/workspace", (req, res) => {
    const plan = store.getWorkspacePlan(req.ws);
    res.json({
      ...store.getWorkspace(req.ws),
      role: req.role,
      memberId: req.memberId,
      plan,
      planInfo: planPublic(plan),
      usage: store.workspaceUsage(req.ws),
      // Whether the server has an AI provider configured (drives the "AI fill" UI).
      enrichConfigured: Boolean(enrich?.enabled),
      // Whether auto-transcription is configured (drives the "Transcribe" button).
      transcribeConfigured: Boolean(transcribe?.enabled),
      // Whether URL/YouTube import is enabled (drives the "Import from URL" row).
      importConfigured: Boolean(importer?.enabled),
      // Whether annual billing can be offered (drives the monthly/annual toggle).
      annualBilling: Boolean(billing?.annualAvailable),
    });
  });

  // --- members ---------------------------------------------------------
  app.get("/api/members", (req, res) => {
    res.json(store.listMembers(req.ws));
  });

  app.post("/api/members", requireAdmin, (req, res) => {
    if (!canAdd(planOf(req), "members", store.workspaceUsage(req.ws).members)) {
      return upgrade(res, `Your plan doesn't allow more members. Upgrade to the Team plan to invite teammates.`);
    }
    const result = store.addMember(req.ws, { name: req.body?.name, role: req.body?.role });
    if (result?.error === "invalid-role") return res.status(400).json({ error: "role must be admin, editor, or viewer" });
    res.status(201).json(result);
  });

  app.delete("/api/members/:id", requireAdmin, (req, res) => {
    const result = store.removeMember(req.ws, req.params.id);
    if (result?.error === "not-found") return res.status(404).json({ error: "Member not found" });
    if (result?.error === "last-admin") return res.status(409).json({ error: "Cannot remove the last admin." });
    res.status(204).end();
  });

  // --- plans & billing -------------------------------------------------
  // Entitlement helpers: 402 (Payment Required) signals "upgrade to continue".
  const planOf = (req) => store.getWorkspacePlan(req.ws);
  const upgrade = (res, msg) => res.status(402).json({ error: msg, upgrade: true });
  const featureGate = (feature, label) => (req, res, next) =>
    hasFeature(planOf(req), feature) ? next() : upgrade(res, `${label} is a paid feature — upgrade your plan.`);

  app.get("/api/plans", (_req, res) => res.json(listPlans()));

  // Start an upgrade. Admin-only; returns a checkout URL (Stripe) or applies the
  // plan immediately in dev mode.
  app.post("/api/billing/checkout", requireAdmin, async (req, res) => {
    const plan = req.body?.plan;
    if (plan !== "pro" && plan !== "team") return res.status(400).json({ error: "Choose the pro or team plan." });
    const interval = req.body?.interval === "year" ? "year" : "month";
    const origin = `${req.protocol}://${req.get("host")}`;
    try {
      const result = await billing.createCheckout({
        workspaceId: req.ws, plan, interval,
        successUrl: `${origin}/?upgraded=${plan}`,
        cancelUrl: `${origin}/?upgrade=cancelled`,
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: `Checkout failed: ${err.message}` });
    }
  });

  // Open the billing portal to manage / cancel the subscription (admin-only).
  app.post("/api/billing/portal", requireAdmin, async (req, res) => {
    const origin = `${req.protocol}://${req.get("host")}`;
    try {
      const result = await billing.createPortal({ workspaceId: req.ws, returnUrl: `${origin}/app` });
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: `Couldn't open billing portal: ${err.message}` });
    }
  });

  // Stripe webhook (raw body, signature-verified, no workspace auth).
  app.post("/api/billing/webhook", express.raw({ type: "*/*" }), (req, res) => {
    const payload = req.body instanceof Buffer ? req.body.toString("utf8") : "";
    if (!billing.verifyWebhook(payload, req.get("stripe-signature"))) {
      return res.status(400).json({ error: "Invalid signature" });
    }
    try {
      billing.applyEvent(JSON.parse(payload));
    } catch {
      return res.status(400).json({ error: "Bad payload" });
    }
    res.json({ received: true });
  });

  // --- audio upload ----------------------------------------------------
  app.post("/api/upload", upload.single("audio"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No audio file (field 'audio') accepted." });
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  // Auto-transcribe an audio URL into timestamped transcript lines. Requires a
  // transcription provider to be configured (503 otherwise). The result is fed
  // back into the normal build flow — nothing here creates a deck directly.
  app.post("/api/transcribe", async (req, res) => {
    if (!transcribe?.enabled) return res.status(503).json({ error: "Auto-transcription isn't configured on this server." });
    const audioUrl = req.body?.audioUrl;
    if (!audioUrl) return res.status(400).json({ error: "Provide an audio URL to transcribe." });
    let result;
    try {
      result = await transcribe.run(audioUrl);
    } catch (err) {
      return res.status(502).json({ error: `Transcription failed: ${err.message}` });
    }
    if (result.error) return res.status(422).json({ error: `Transcription failed (${result.error}).` });
    if (!result.transcript) return res.status(422).json({ error: "No speech was transcribed from that audio." });
    res.json(result);
  });

  // --- no-signup demo --------------------------------------------------
  // Turn a pasted transcript into cards (with suggested cloze blanks) without
  // an account or any persistence — this is the "try it before you sign up"
  // widget on the marketing site. Reuses the exact segmentation + cloze engine
  // the real app uses, so what a visitor sees is genuine, not a mock. Inputs
  // are capped so the endpoint can't be abused as unbounded free compute.
  const DEMO_MAX_INPUT = 20000;   // characters of transcript accepted
  const DEMO_MAX_CARDS = 12;      // cards returned (the "aha", not the whole app)
  app.post("/api/demo/build", demoLimiter, (req, res) => {
    const transcript = String(req.body?.transcript ?? "");
    if (!transcript.trim()) return res.status(400).json({ error: "Paste some text, subtitles, or a transcript to build cards from." });
    if (transcript.length > DEMO_MAX_INPUT) {
      return res.status(413).json({ error: `That's a lot of text for the demo — try up to ${DEMO_MAX_INPUT.toLocaleString()} characters, or sign up free to build the full deck.` });
    }
    const maxChars = Number(req.body?.maxChars) || undefined;
    const all = segmentTranscript(transcript, { maxChars });
    const segments = all.slice(0, DEMO_MAX_CARDS).map((seg) => {
      const term = suggestCloze(seg.text);
      const cloze = term ? applyCloze(seg.text, term) : null;
      return { text: seg.text, start: seg.start, end: seg.end, cloze };
    });
    res.json({ segments, total: all.length, truncated: all.length > segments.length });
  });

  // Score a shadowing attempt in the demo (target text vs. what the browser
  // heard). Same pure scorer the app uses; no card / workspace involved.
  app.post("/api/demo/score", demoLimiter, (req, res) => {
    const target = String(req.body?.target ?? "");
    if (!target.trim()) return res.status(400).json({ error: "Missing target text." });
    res.json(scoreAttempt(target, String(req.body?.heard ?? "")));
  });

  // Import a transcript from a URL (YouTube captions, or a direct .srt/.vtt/.txt
  // link). Returns { title, language, transcript, segments } so the client can
  // populate the build form; building the deck is a separate, gated step.
  const IMPORT_ERRORS = {
    "not-configured": "URL import isn't enabled on this server.",
    "no-url": "Paste a URL to import.",
    "blocked": "That URL can't be imported.",
    "no-captions": "That video has no captions available to import.",
    "empty-captions": "That video's captions came back empty.",
    "unsupported-page": "That link is a web page, not a transcript. Paste a YouTube link, or a direct .srt/.vtt/.txt URL.",
    "empty": "Nothing to import from that URL.",
    "fetch-failed": "Couldn't fetch that URL — check the link and try again.",
  };
  app.post("/api/import", importLimiter, async (req, res) => {
    if (!importer?.enabled) return res.status(503).json({ error: IMPORT_ERRORS["not-configured"] });
    const url = req.body?.url;
    if (!String(url || "").trim()) return res.status(400).json({ error: IMPORT_ERRORS["no-url"] });
    let result;
    try {
      result = await importer.run(url, { lang: req.body?.lang });
    } catch (err) {
      return res.status(502).json({ error: `Import failed: ${err.message}` });
    }
    if (result.error) {
      const status = result.error === "blocked" ? 400 : 422;
      // Only the guard's own message is user-facing; other providers' raw errors
      // (e.g. "upstream responded 403") are replaced with friendly copy.
      const error = result.error === "blocked" ? (result.message || IMPORT_ERRORS.blocked) : (IMPORT_ERRORS[result.error] || "Import failed.");
      return res.status(status).json({ error });
    }
    const segments = segmentTranscript(result.transcript, {});
    res.json({ ...result, segments, segmentCount: segments.length });
  });

  // --- decks -----------------------------------------------------------
  app.post("/api/decks", (req, res) => {
    const { title, language, audioUrl, transcript, maxChars } = req.body ?? {};
    const use = store.workspaceUsage(req.ws);
    if (!canAdd(planOf(req), "decks", use.decks)) {
      return upgrade(res, `You've reached the deck limit on the Free plan. Upgrade for unlimited decks.`);
    }
    const segments = segmentTranscript(transcript ?? "", { maxChars: Number(maxChars) || undefined });
    if (!canAdd(planOf(req), "cards", use.cards, segments.length)) {
      return upgrade(res, `This would exceed your card limit. Upgrade for unlimited cards.`);
    }
    const deck = store.createDeck(req.ws, { title, language, audioUrl });
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

  // Study statistics for the dashboard (paid feature).
  app.get("/api/stats", featureGate("stats", "The study dashboard"), (req, res) => {
    res.json(store.stats(req.ws));
  });

  // Creator analytics: reach (views + installs) of the workspace's shared decks.
  // Gated behind sharing since only shared decks have reach to report.
  app.get("/api/creator/stats", featureGate("sharing", "Creator analytics"), (req, res) => {
    res.json(store.creatorStats(req.ws));
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
  app.post("/api/reminders/test", featureGate("reminders", "Reminders"), async (req, res) => {
    if (!reminders) return res.status(400).json({ error: "Reminders are not configured." });
    try {
      const result = await reminders.run({ workspaceId: req.ws, force: true });
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: `Reminder delivery failed: ${err.message}` });
    }
  });

  // --- web push --------------------------------------------------------
  // Public config for the client: whether push is available + the VAPID key
  // needed to subscribe.
  app.get("/api/push/config", (req, res) => {
    res.json({ enabled: Boolean(push?.enabled), publicKey: push?.publicKey ?? null });
  });

  // Register this device's push subscription for the workspace.
  app.post("/api/push/subscribe", (req, res) => {
    if (!push?.enabled) return res.status(503).json({ error: "Push notifications aren't configured on this server." });
    const result = store.addPushSubscription(req.ws, req.body?.subscription);
    if (result?.error) return res.status(400).json({ error: "Invalid push subscription." });
    res.status(201).json({ ok: true });
  });

  app.post("/api/push/unsubscribe", (req, res) => {
    store.removePushSubscription(req.ws, req.body?.endpoint);
    res.status(204).end();
  });

  // Send a test push to this workspace's subscribed devices (paid; needs push).
  app.post("/api/push/test", featureGate("reminders", "Reminders"), async (req, res) => {
    if (!push?.enabled) return res.status(503).json({ error: "Push notifications aren't configured on this server." });
    const summary = store.dueSummary(req.ws);
    const message = summary.totalDue > 0
      ? { title: `EchoDeck: ${summary.totalDue} card${summary.totalDue === 1 ? "" : "s"} to review`, body: `You have ${summary.totalDue} card${summary.totalDue === 1 ? "" : "s"} due.` }
      : { title: "EchoDeck", body: "Test notification — you're all caught up." };
    try {
      const result = await deliverToWorkspace({ store, push, workspaceId: req.ws, message });
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: `Push failed: ${err.message}` });
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
    if (!canAdd(planOf(req), "cards", store.workspaceUsage(req.ws).cards, segments.length)) {
      return upgrade(res, `This would exceed your card limit. Upgrade for unlimited cards.`);
    }
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
  app.post("/api/decks/:id/share", featureGate("sharing", "Public sharing"), (req, res) => {
    const deck = store.publishDeck(req.params.id, req.ws);
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    res.json({ shareId: deck.shareId, shareUrl: `${req.protocol}://${req.get("host")}/s/${deck.shareId}` });
  });

  app.delete("/api/decks/:id/share", (req, res) => {
    const deck = store.unpublishDeck(req.params.id, req.ws);
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    res.status(204).end();
  });

  // Public, read-only deck data (no private scheduling state). Counts one view
  // for the creator's analytics (export and the HTML shell don't count).
  app.get("/api/shared/:shareId", (req, res) => {
    const deck = store.getSharedDeck(req.params.shareId);
    if (!deck) return res.status(404).json({ error: "Shared deck not found" });
    store.recordShareView(req.params.shareId);
    res.json(deck);
  });

  app.get("/api/shared/:shareId/export", (req, res) => {
    const deck = store.getSharedDeck(req.params.shareId);
    if (!deck) return res.status(404).json({ error: "Shared deck not found" });
    sendExport(res, deck, deck.cards, req.query.format);
  });

  // Public viewer page. Inject per-deck SEO/social meta server-side (crawlers
  // don't run the client JS), so shared links unfurl nicely and are indexable.
  const shareTemplate = readFileSync(join(PUBLIC_DIR, "share.html"), "utf8");
  app.get("/s/:shareId", (req, res) => {
    const deck = store.getSharedDeck(req.params.shareId);
    const origin = `${req.protocol}://${req.get("host")}`;
    let head;
    if (deck) {
      const lang = deck.language ? `${deck.language} ` : "";
      head = seoTags({
        title: `${deck.title} — ${lang}flashcards & shadowing · EchoDeck`,
        description: `Study "${deck.title}" — ${deck.cards.length} ${lang}flashcard${deck.cards.length === 1 ? "" : "s"} with audio shadowing loops and spaced repetition on EchoDeck.`,
        url: `${origin}/s/${req.params.shareId}`,
        image: `${origin}/og.svg`,
      });
    } else {
      head = `<title>Shared deck — EchoDeck</title>`;
    }
    res.type("html").send(shareTemplate.replace("<!--SEO-->", head));
  });

  // Crawl directives + a sitemap of public surfaces. Only *listed* (marketplace)
  // decks are enumerated — private share links are never exposed here.
  app.get("/robots.txt", (req, res) => {
    const origin = `${req.protocol}://${req.get("host")}`;
    res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /app\nSitemap: ${origin}/sitemap.xml\n`);
  });
  app.get("/sitemap.xml", (req, res) => {
    const origin = `${req.protocol}://${req.get("host")}`;
    const urls = [`${origin}/`, `${origin}/demo`, `${origin}/marketplace`];
    for (const d of store.listMarketplace({ limit: 5000 })) urls.push(`${origin}/s/${d.shareId}`);
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      urls.map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`).join("\n")
    }\n</urlset>\n`;
    res.type("application/xml").send(body);
  });

  // --- marketplace -----------------------------------------------------
  // List a deck in the public catalog (implies sharing, so it's gated the same
  // way). An optional description helps learners find it.
  app.post("/api/decks/:id/list", featureGate("sharing", "The marketplace"), (req, res) => {
    const result = store.listDeck(req.params.id, req.ws, { description: req.body?.description });
    if (!result) return res.status(404).json({ error: "Deck not found" });
    res.json({ ...result, shareUrl: `${req.protocol}://${req.get("host")}/s/${result.shareId}` });
  });

  app.delete("/api/decks/:id/list", (req, res) => {
    const result = store.unlistDeck(req.params.id, req.ws);
    if (!result) return res.status(404).json({ error: "Deck not found" });
    res.status(204).end();
  });

  // Public catalog of listed decks (no auth). Supports a text query and a
  // language filter.
  app.get("/api/marketplace", (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 60, 200);
    res.json(store.listMarketplace({ q: req.query.q ?? "", language: req.query.language ?? "", limit }));
  });

  // Install (clone) a listed deck into the caller's workspace. Subject to the
  // caller's plan limits; bumps the source deck's install count.
  app.post("/api/marketplace/:shareId/install", (req, res) => {
    const listing = store.getListing(req.params.shareId);
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    const use = store.workspaceUsage(req.ws);
    if (!canAdd(planOf(req), "decks", use.decks)) {
      return upgrade(res, `You've reached the deck limit on the Free plan. Upgrade for unlimited decks.`);
    }
    if (!canAdd(planOf(req), "cards", use.cards, listing.cardCount)) {
      return upgrade(res, `Installing this deck would exceed your card limit. Upgrade for unlimited cards.`);
    }
    const result = store.installListing(req.params.shareId, req.ws);
    if (!result) return res.status(404).json({ error: "Listing not found" });
    res.status(201).json(result);
  });

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

  // Score a shadowing attempt against a card's text. `heard` is the recognised
  // transcript of what the learner said (from the browser's Web Speech API or a
  // server-side STT step). Optionally applies the suggested SRS grade so
  // speaking practice feeds the schedule directly.
  app.post("/api/cards/:id/pronounce", (req, res) => {
    const card = store.getCard(req.params.id, req.ws);
    if (!card) return res.status(404).json({ error: "Card not found" });
    const result = scoreAttempt(card.front, req.body?.heard ?? "");
    let updated = null;
    if (req.body?.applyGrade) {
      updated = store.reviewCard(req.params.id, GRADE_MAP[result.suggestedGrade], req.ws);
    }
    res.json({ ...result, cardId: card.id, applied: Boolean(updated), card: updated });
  });

  // AI-fill a card's back (translation) and notes (grammar/example). Paid
  // feature; also requires the server to have an AI provider configured.
  app.post("/api/cards/:id/enrich", featureGate("enrich", "AI card fill"), async (req, res) => {
    if (!enrich?.enabled) return res.status(503).json({ error: "AI fill isn't configured on this server." });
    const card = store.getCard(req.params.id, req.ws);
    if (!card) return res.status(404).json({ error: "Card not found" });
    const overwrite = req.body?.overwrite === true;
    const deck = store.getDeck(card.deckId, req.ws);
    let result;
    try {
      result = await enrich.enrich(card.front, deck?.language);
    } catch (err) {
      return res.status(502).json({ error: `AI fill failed: ${err.message}` });
    }
    if (result.error) return res.status(422).json({ error: `Couldn't generate a card back (${result.error}).` });
    const patch = {};
    if (overwrite || !card.back) patch.back = result.back;
    if (overwrite || !card.notes) patch.notes = result.notes;
    const updated = Object.keys(patch).length ? store.updateCard(card.id, patch, req.ws) : card;
    res.json({ generated: result, card: updated });
  });

  // Bulk AI-fill: fill the back of every card in a deck that doesn't have one
  // yet (capped so a single request can't fan out unbounded LLM calls).
  app.post("/api/decks/:id/enrich", featureGate("enrich", "AI card fill"), async (req, res) => {
    if (!enrich?.enabled) return res.status(503).json({ error: "AI fill isn't configured on this server." });
    const deck = store.getDeck(req.params.id, req.ws);
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    const targets = deck.cards.filter((c) => !c.back).slice(0, 40);
    let updated = 0;
    for (const c of targets) {
      let result;
      try {
        result = await enrich.enrich(c.front, deck.language);
      } catch (err) {
        return res.status(502).json({ error: `AI fill failed after ${updated} cards: ${err.message}`, updated });
      }
      if (result.error) continue;
      store.updateCard(c.id, { back: result.back, notes: c.notes || result.notes }, req.ws);
      updated++;
    }
    res.json({ updated, deck: store.getDeck(req.params.id, req.ws) });
  });

  // --- pages -----------------------------------------------------------
  // Marketing landing page at the root; the app itself lives at /app.
  app.get("/", (_req, res) => res.sendFile(join(PUBLIC_DIR, "landing.html")));
  app.get("/app", (_req, res) => res.sendFile(join(PUBLIC_DIR, "index.html")));
  app.get("/demo", (_req, res) => res.sendFile(join(PUBLIC_DIR, "demo.html")));
  app.get("/marketplace", (_req, res) => res.sendFile(join(PUBLIC_DIR, "marketplace.html")));
  app.get("/terms", (_req, res) => res.sendFile(join(PUBLIC_DIR, "terms.html")));
  app.get("/privacy", (_req, res) => res.sendFile(join(PUBLIC_DIR, "privacy.html")));
  app.get("/reset", (_req, res) => res.sendFile(join(PUBLIC_DIR, "reset.html")));

  // --- static ----------------------------------------------------------
  app.use("/uploads", express.static(uploadsDir));
  app.use(express.static(PUBLIC_DIR, { index: false }));
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Unmatched API routes return JSON, not the SPA shell.
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // Central error handler — never leak stack traces to clients.
  app.use((err, _req, res, _next) => {
    console.error("[error]", err?.message || err);
    if (res.headersSent) return;
    res.status(err?.status || 500).json({ error: "Something went wrong." });
  });

  return app;
}
