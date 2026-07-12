import { logger } from "./logger";

// Provider-agnostic outbound email. Points at a single webhook
// (EMAIL_WEBHOOK_URL) that a relay — Resend/Postmark/SendGrid, or Zapier/Make —
// turns into an actual email. When unset, the message is logged so the surface
// is always inspectable in dev. Never throws: a failed alert email must not
// crash the worker loop.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  from?: string;
}

// The verified sender the relay sends from. Overridable per-message, else from
// EMAIL_FROM, else HOLTO's own address.
const DEFAULT_FROM = process.env.EMAIL_FROM ?? "HOLTO <hello@holtotravel.com>";

export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const url = process.env.EMAIL_WEBHOOK_URL;
  const payload = { ...msg, from: msg.from ?? DEFAULT_FROM };

  if (!url) {
    logger.info({ to: payload.to, subject: payload.subject, from: payload.from }, `[email:console] ${payload.text}`);
    return true;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.warn({ status: res.status, to: msg.to }, "Email webhook returned non-OK");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, to: msg.to }, "Email webhook request failed");
    return false;
  }
}
