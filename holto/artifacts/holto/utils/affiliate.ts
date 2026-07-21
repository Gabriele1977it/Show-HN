import { Platform } from "react-native";

// GoAffPro affiliate conversion tracking.
//
// The GoAffPro loader script (api.goaffpro.com/loader.js) is injected into the
// web PWA's <head> at build time (see scripts/inject-pwa.mjs), so on any web
// page `window.goaffproTrackConversion` becomes available once the loader runs.
// This helper reports a completed sale to it with the *real* order data.
//
// It is a deliberate no-op on native (the loader only exists in the web build)
// and idempotent per browser: the same order number is reported at most once,
// so refreshing a "thank you" screen can never double-count a sale.
type GoAffProWindow = {
  goaffpro_order?: { number: string; total: number };
  goaffproTrackConversion?: () => void;
  localStorage?: Storage;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
};

export function trackAffiliateConversion(number: string | number, total: number | string): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const orderNumber = String(number).trim();
  const amount = typeof total === "string" ? parseFloat(total) : total;
  if (!orderNumber || !Number.isFinite(amount)) return;

  const w = window as unknown as GoAffProWindow;

  // Dedupe across refreshes. If storage is blocked (private mode) we proceed
  // rather than silently drop the sale.
  try {
    const key = `goaffpro_tracked_${orderNumber}`;
    if (w.localStorage?.getItem(key)) return;
    w.localStorage?.setItem(key, "1");
  } catch {
    /* storage unavailable — track anyway */
  }

  w.goaffpro_order = { number: orderNumber, total: amount };

  const fire = () => {
    try {
      w.goaffproTrackConversion?.();
    } catch {
      /* loader threw — nothing we can do */
    }
  };

  if (typeof w.goaffproTrackConversion === "function") {
    fire();
    return;
  }

  // The loader is async; wait briefly for it to define the function.
  let tries = 0;
  const id = w.setInterval(() => {
    tries += 1;
    if (typeof w.goaffproTrackConversion === "function" || tries > 40) {
      w.clearInterval(id);
      fire();
    }
  }, 250);
}
