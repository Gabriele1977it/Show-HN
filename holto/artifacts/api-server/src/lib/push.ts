import { logger } from "./logger";

// Delivery of proactive alerts to devices via the Expo Push API.
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

export interface PushAlert {
  title: string;
  body: string;
  // Structured payload the app reads on tap to deep-link the user.
  data?: Record<string, unknown>;
}

export interface PushResult {
  sent: number;
  failed: number;
}

interface ExpoMessage extends PushAlert {
  to: string;
  sound: "default";
  priority: "high";
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Send one alert to many Expo push tokens. Invalid tokens are skipped (and
 * their receipts logged) so a single bad token never blocks the batch.
 * Returns counts; never throws — alerting must not crash the worker loop.
 */
export async function sendPush(tokens: string[], alert: PushAlert): Promise<PushResult> {
  const valid = tokens.filter((t) => t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken"));
  if (valid.length === 0) return { sent: 0, failed: 0 };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  let sent = 0;
  let failed = 0;

  for (const batch of chunk(valid, BATCH_SIZE)) {
    const messages: ExpoMessage[] = batch.map((to) => ({
      to,
      sound: "default",
      priority: "high",
      title: alert.title,
      body: alert.body,
      data: alert.data,
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(messages),
      });
      const json = (await res.json()) as { data?: Array<{ status: string; message?: string }> };

      if (!res.ok || !json.data) {
        logger.warn({ status: res.status, json }, "Expo push batch failed");
        failed += batch.length;
        continue;
      }

      for (const ticket of json.data) {
        if (ticket.status === "ok") sent += 1;
        else {
          failed += 1;
          logger.warn({ ticket }, "Expo push ticket error");
        }
      }
    } catch (err) {
      logger.warn({ err }, "Expo push request threw");
      failed += batch.length;
    }
  }

  logger.info({ sent, failed }, "Push alerts delivered");
  return { sent, failed };
}
