import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Diagnostic: which Gemini models this key can actually use. Never exposes the
// key; returns only model names + any error, so a non-technical user can open
// it in a browser and share the result. Handy when document reading 404s.
router.get("/health/gemini", async (_req, res) => {
  const key = process.env.GEMINI_API_KEY ?? "";
  if (!key) {
    res.json({ configured: false, note: "GEMINI_API_KEY is not set on this service." });
    return;
  }
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      res.json({ configured: true, ok: false, status: r.status, error: body.slice(0, 400) });
      return;
    }
    const json = (await r.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    const usable = (json.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter((n) => n.includes("flash") || n.includes("pro"));
    res.json({ configured: true, ok: true, usableModels: usable });
  } catch (err) {
    res.json({ configured: true, ok: false, error: err instanceof Error ? err.message : "request failed" });
  }
});

export default router;
