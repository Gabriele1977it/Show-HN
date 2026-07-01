// Transactional email.
//
// Provider-agnostic, mirroring the reminders/billing pattern: when an
// EMAIL_WEBHOOK_URL is configured, messages are POSTed there as JSON (point it
// at Resend/Postmark/SendGrid via a relay, Zapier/Make, or your own endpoint).
// With nothing configured it logs to the console ("dev mode"), and the caller
// can surface the link directly so flows are testable without a provider.

export function createMailer({ webhookUrl, fetchImpl = fetch, log = console.log } = {}) {
  const enabled = Boolean(webhookUrl);

  async function send({ to, subject, text, html }) {
    if (!enabled) {
      log(`[email:dev] to=${to} subject="${subject}"\n${text}`);
      return { delivered: "console" };
    }
    const res = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, text, html }),
    });
    if (!res.ok) throw new Error(`Email webhook responded ${res.status}`);
    return { delivered: "webhook", status: res.status };
  }

  return { enabled, send };
}
