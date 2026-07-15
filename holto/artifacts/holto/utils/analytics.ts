// Fire-and-forget, privacy-friendly analytics. Sends only an event name to the
// aggregated counter endpoint — no user id, no properties, no PII. Never throws
// and never blocks the UI; a failure is simply ignored.

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export type AnalyticsEvent =
  | "app_open"
  | "news_view"
  | "today_view"
  | "ask_used"
  | "scan_booking"
  | "scan_receipt"
  | "claim_started"
  | "watchlist_add"
  | "upgrade_view"
  | "calendar_add"
  | "esim_checkout_start";

export function track(event: AnalyticsEvent): void {
  try {
    void fetch(`${API_BASE}/api/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never let analytics break anything */
  }
}
