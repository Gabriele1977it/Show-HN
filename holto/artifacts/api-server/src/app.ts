import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

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
  "https://holtotravel.com",
  "https://www.holtotravel.com",
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
