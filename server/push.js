// Web Push (browser notifications).
//
// Lets an installed PWA receive "cards due" reminders even when closed. Mirrors
// the enrich/transcribe pattern: enabled only when VAPID keys are configured
// (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY), degrades gracefully otherwise, and
// accepts an injected `send` so the plumbing is unit-testable without a live
// push service. Generate keys once with: npx web-push generate-vapid-keys
//
// Delivery to a real browser can't be exercised in CI (no push endpoint), so
// the sender is injected in tests; the live path uses the `web-push` library.

import webpush from "web-push";

export function createPushService({ publicKey, privateKey, subject = "mailto:gabriele.olivari@outlook.com", send } = {}) {
  let enabled = Boolean(send || (publicKey && privateKey));
  if (!send && enabled) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } catch {
      enabled = false; // malformed keys → treat as unconfigured rather than crash
    }
  }
  const sender = send || ((subscription, payload) => webpush.sendNotification(subscription, payload));

  return {
    enabled,
    publicKey: enabled ? (publicKey ?? null) : null,
    // Send a notification payload to one subscription. Throws on failure with a
    // `.statusCode` (404/410 mean the subscription is dead and should be pruned).
    async notify(subscription, data) {
      if (!enabled) return { ok: false, error: "not-configured" };
      await sender(subscription, JSON.stringify(data));
      return { ok: true };
    },
  };
}

/**
 * Fan a reminder message out to every push subscription in a workspace, pruning
 * subscriptions the push service reports as gone. Returns { pushed, pruned }.
 */
export async function deliverToWorkspace({ store, push, workspaceId, message }) {
  if (!push?.enabled) return { pushed: 0, pruned: 0 };
  const payload = { title: message.title, body: message.body, url: "/app" };
  let pushed = 0, pruned = 0;
  for (const sub of store.listPushSubscriptions(workspaceId)) {
    try {
      await push.notify(sub, payload);
      pushed++;
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        store.removePushSubscription(workspaceId, sub.endpoint);
        pruned++;
      }
    }
  }
  return { pushed, pruned };
}
