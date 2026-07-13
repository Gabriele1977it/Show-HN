import { logger } from "./logger";

// Provider-agnostic outbound email. Delivery is chosen at runtime, in order:
//   1. RESEND_API_KEY set  → send directly via the Resend API (transactional,
//      best deliverability — used for password-reset links).
//   2. EMAIL_WEBHOOK_URL   → POST the message to a relay (Make/Zapier/etc.).
//   3. neither             → log the message so the surface stays inspectable
//      in dev.
// Never throws: a failed alert email must not crash the worker loop.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  from?: string;
}

// The verified sender we send from. Overridable per-message, else from
// EMAIL_FROM, else HOLTO's verified sending subdomain (send.holtotravel.co.uk —
// kept separate from the apex domain so transactional mail has its own
// deliverability reputation).
const DEFAULT_FROM = process.env.EMAIL_FROM ?? "HOLTO <hello@send.holtotravel.co.uk>";

async function sendViaResend(payload: Required<EmailMessage>, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.warn({ status: res.status, to: payload.to, detail }, "Resend returned non-OK");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, to: payload.to }, "Resend request failed");
    return false;
  }
}

async function sendViaWebhook(payload: Required<EmailMessage>, url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.warn({ status: res.status, to: payload.to }, "Email webhook returned non-OK");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, to: payload.to }, "Email webhook request failed");
    return false;
  }
}

export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const payload: Required<EmailMessage> = { ...msg, from: msg.from ?? DEFAULT_FROM };

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) return sendViaResend(payload, resendKey);

  const url = process.env.EMAIL_WEBHOOK_URL;
  if (url) return sendViaWebhook(payload, url);

  logger.info({ to: payload.to, subject: payload.subject, from: payload.from }, `[email:console] ${payload.text}`);
  return true;
}
