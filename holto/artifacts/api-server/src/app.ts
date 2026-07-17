import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { captureError } from "./lib/sentry";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

// Behind Render/Fly/etc. the client IP arrives in X-Forwarded-For. Trust the
// first proxy hop so req.ip is the real client (required for per-IP rate limits
// to bucket by client rather than by the shared proxy address).
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Baseline security headers for the JSON API (no dependency needed). These are
// cheap defence-in-depth even though the API returns data, not HTML.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow the HOLTO website, any explicitly configured origins, all Replit
// preview/production domains, and localhost. Extra origins come from the
// `ALLOWED_ORIGINS` env var (comma-separated) so the API is portable to any host
// (Render, Fly, etc.) without a code change; the deployed base URL in
// `APP_ORIGIN`/`PUBLIC_URL` is trusted too when set.
const ENV_ORIGINS = [
  process.env.APP_ORIGIN,
  process.env.PUBLIC_URL,
  ...(process.env.ALLOWED_ORIGINS ?? "").split(","),
]
  .map((o) => o?.trim().replace(/\/+$/, ""))
  .filter((o): o is string => Boolean(o));

const ALLOWED_ORIGIN_PATTERNS: (string | RegExp)[] = [
  /^https:\/\/([\w-]+\.)?holtotravel\.com$/,   // live app + any subdomain (app., www., …)
  /^https:\/\/([\w-]+\.)?holtotravel\.co\.uk$/, // also owned; allowed in case of a .co.uk redirect
  ...ENV_ORIGINS,
  /^https:\/\/[\w-]+\.onrender\.com$/,         // the HOLTO web (PWA) on Render
  /^https:\/\/[\w-]+-[\w-]+\.replit\.app$/,   // published Replit apps
  /^https:\/\/[\w-]+-[\w-]+-[\w-]+\.replit\.dev$/, // Replit dev preview
  /^https?:\/\/localhost(:\d+)?$/,             // local dev
];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser clients (curl, mobile app native layer)
  return ALLOWED_ORIGIN_PATTERNS.some((p) =>
    typeof p === "string" ? p === origin : p.test(origin),
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin not allowed — ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: unknown) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

// Booking-document uploads (base64 PDF/image) need a larger body than the
// default 100kb. Mount a bigger JSON parser for just that path first; the
// global parser below then no-ops for it (body already parsed) and keeps the
// tight default everywhere else.
app.use("/api/trips/parse-file", express.json({ limit: "12mb" }));
app.use("/api/expenses/scan", express.json({ limit: "12mb" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Final error handler: report to Sentry (if enabled), log, and return a clean
// 500. Express 5 forwards rejected async handlers here automatically.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  captureError(err, { path: req.path, method: req.method });
  logger.error({ err, path: req.path, method: req.method }, "Unhandled route error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
});

export default app;
