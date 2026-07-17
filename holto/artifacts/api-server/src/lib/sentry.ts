import { randomUUID } from "node:crypto";

import { logger } from "./logger";

// Dependency-free error tracking. Reports unhandled errors straight to Sentry's
// ingest API over fetch — no SDK, so nothing gets pulled into the dependency
// tree (the full @sentry/node SDK drags in OpenTelemetry, which changes how
// drizzle-orm resolves and breaks our DB types). Dormant until SENTRY_DSN is
// set: no DSN ⇒ no network, no behaviour change. Errors only — no tracing.

interface Dsn {
  storeUrl: string;
  publicKey: string;
}

let dsn: Dsn | null = null;
let component = "web";
let environment = "production";
let release: string | undefined;

// DSN format: https://<publicKey>@<host>/<projectId>
export function parseDsn(raw: string): Dsn | null {
  try {
    const u = new URL(raw.trim());
    const projectId = u.pathname.replace(/^\/+/, "");
    if (!u.username || !projectId) return null;
    return { storeUrl: `${u.protocol}//${u.host}/api/${projectId}/store/`, publicKey: u.username };
  } catch {
    return null;
  }
}

export function initSentry(comp: "web" | "worker"): void {
  const raw = process.env.SENTRY_DSN?.trim();
  if (!raw || dsn) return;
  const parsed = parseDsn(raw);
  if (!parsed) {
    logger.warn("SENTRY_DSN is set but not a valid DSN — error tracking disabled");
    return;
  }
  dsn = parsed;
  component = comp;
  environment = process.env.NODE_ENV ?? "production";
  release = process.env.RENDER_GIT_COMMIT || undefined;
  logger.info({ component }, "Sentry error tracking enabled (lightweight reporter)");

  // Catch the crashes Express can't (background timers, event handlers).
  process.on("unhandledRejection", (reason) => {
    captureError(reason, { kind: "unhandledRejection" });
    logger.error({ err: reason }, "unhandledRejection");
  });
  process.on("uncaughtException", (err) => {
    captureError(err, { kind: "uncaughtException" });
    logger.error({ err }, "uncaughtException");
  });
}

export function sentryEnabled(): boolean {
  return dsn !== null;
}

// Fire-and-forget: report an error to Sentry. Never throws, never blocks.
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
  const event = {
    event_id: randomUUID().replace(/-/g, ""),
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    logger: "holto",
    environment,
    release,
    server_name: component,
    tags: { component },
    extra: { ...context, stack: e.stack },
    exception: { values: [{ type: e.name || "Error", value: e.message }] },
  };
  const auth = `Sentry sentry_version=7, sentry_client=holto/1.0, sentry_key=${dsn.publicKey}`;
  void fetch(dsn.storeUrl, {
    method: "POST",
    signal: AbortSignal.timeout(4000),
    headers: { "Content-Type": "application/json", "X-Sentry-Auth": auth },
    body: JSON.stringify(event),
  }).catch(() => {
    /* never let error reporting cause errors */
  });
}
