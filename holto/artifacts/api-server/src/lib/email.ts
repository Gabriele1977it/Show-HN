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
}

export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const url = process.env.EMAIL_WEBHOOK_URL;

  if (!url) {
    logger.info({ to: msg.to, subject: msg.subject }, `[email:console] ${msg.text}`);
    return true;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(msg),
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
