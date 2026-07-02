// Transactional email.
//
// Three modes, chosen by what's configured (checked in priority order):
//
//   1. Resend (native)  — set RESEND_API_KEY + EMAIL_FROM. Sends directly to
//                         Resend's API; the simplest path to real email (no
//                         relay to build). Any Resend-compatible key works.
//   2. Webhook          — set EMAIL_WEBHOOK_URL. POSTs {to,subject,text,html}
//                         as JSON to your own relay (Postmark/SendGrid/Zapier…).
//   3. Dev (default)    — nothing configured: logs to the console, and callers
//                         surface links directly so flows stay testable.
//
// The network call is injectable (fetchImpl) so every mode is unit-testable.

export function createMailer({ webhookUrl, apiKey, from, fetchImpl = fetch, log = console.log } = {}) {
  const mode = apiKey && from ? "resend" : webhookUrl ? "webhook" : "dev";
  const enabled = mode !== "dev";

  async function sendResend({ to, subject, text, html }) {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, html }),
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json())?.message || ""; } catch {}
      throw new Error(`Resend responded ${res.status}${detail ? `: ${detail}` : ""}`);
    }
    return { delivered: "resend", status: res.status };
  }

  async function sendWebhook({ to, subject, text, html }) {
    const res = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, text, html }),
    });
    if (!res.ok) throw new Error(`Email webhook responded ${res.status}`);
    return { delivered: "webhook", status: res.status };
  }

  async function send({ to, subject, text, html }) {
    if (mode === "resend") return sendResend({ to, subject, text, html });
    if (mode === "webhook") return sendWebhook({ to, subject, text, html });
    log(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return { delivered: "console" };
  }

  return { enabled, mode, send };
}
