// Review reminders.
//
// Turns the cross-deck due summary (store.dueSummary) into a "you have cards to
// review" nudge and delivers it through a pluggable notifier. The notifier is
// intentionally generic: a single outbound webhook covers push (ntfy.sh),
// chat (Slack / Discord), and email-relay services (Zapier, Make, Mailgun),
// so no provider credentials are baked into the app.

/**
 * Format a due summary into a reminder message, or null when nothing is due.
 * @param {{totalDue:number, decksDue:Array<{title:string,dueCount:number}>, nextDue:number|null}} summary
 */
export function formatReminder(summary) {
  if (!summary || summary.totalDue <= 0) return null;
  const n = summary.totalDue;
  const decks = summary.decksDue
    .map((d) => `• ${d.title}: ${d.dueCount} due`)
    .join("\n");
  return {
    title: `EchoDeck: ${n} card${n === 1 ? "" : "s"} ready to review`,
    body: `You have ${n} card${n === 1 ? "" : "s"} due across ${summary.decksDue.length} deck${summary.decksDue.length === 1 ? "" : "s"}.\n${decks}`,
    totalDue: n,
  };
}

/**
 * Decide whether a reminder should go out now.
 * Suppresses sends below `minDue` and within `minIntervalMs` of the last one.
 */
export function shouldSend(summary, lastSentAt, now, { minDue = 1, minIntervalMs = 0 } = {}) {
  if (!summary || summary.totalDue < minDue) return false;
  if (lastSentAt != null && now - lastSentAt < minIntervalMs) return false;
  return true;
}

/** Notifier that logs to the console — the safe default when no webhook is set. */
export function consoleNotifier(log = console.log) {
  return async (msg) => {
    log(`[reminder] ${msg.title}\n${msg.body}`);
    return { delivered: "console" };
  };
}

/**
 * Notifier that POSTs the message as JSON to a webhook URL.
 * Point it at ntfy.sh, a Slack/Discord incoming webhook, or an email relay.
 */
export function webhookNotifier(url, fetchImpl = fetch) {
  return async (msg) => {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: msg.title, body: msg.body, totalDue: msg.totalDue }),
    });
    if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
    return { delivered: "webhook", status: res.status };
  };
}

/**
 * Build the reminder service.
 * Reminders are workspace-scoped: the due summary, throttle state, and polling
 * are all keyed by workspace id.
 * @param {object} opts
 * @param {{dueSummary:(ws:string,now?:number)=>object, listWorkspaceIds:()=>string[]}} opts.store
 * @param {(msg:object)=>Promise<any>} opts.notify
 * @param {{minDue?:number, minIntervalMs?:number, pollMs?:number}} [opts.config]
 */
export function createReminderService({ store, notify, config = {} }) {
  const minDue = config.minDue ?? 1;
  const minIntervalMs = config.minIntervalMs ?? 12 * 60 * 60 * 1000; // twice a day max
  const pollMs = config.pollMs ?? 30 * 60 * 1000; // check every 30 min
  const lastSentAt = new Map(); // workspaceId -> epoch ms of last send
  let timer = null;

  /** What a reminder would look like right now for a workspace (no send). */
  function preview(ws, now = Date.now()) {
    const summary = store.dueSummary(ws, now);
    const message = formatReminder(summary);
    const last = lastSentAt.get(ws) ?? null;
    return {
      message,
      wouldSend: message != null && shouldSend(summary, last, now, { minDue, minIntervalMs }),
      lastSentAt: last,
      config: { minDue, minIntervalMs, pollMs },
    };
  }

  /**
   * Evaluate a workspace's summary and send if warranted.
   * @param {{workspaceId:string, now?:number, force?:boolean}} o `force` ignores the de-dupe gate.
   */
  async function run({ workspaceId, now = Date.now(), force = false }) {
    const summary = store.dueSummary(workspaceId, now);
    const message = formatReminder(summary);
    if (!message) return { sent: false, reason: "nothing-due" };
    const last = lastSentAt.get(workspaceId) ?? null;
    if (!force && !shouldSend(summary, last, now, { minDue, minIntervalMs })) {
      return { sent: false, reason: last == null ? "below-min-due" : "throttled", message };
    }
    const result = await notify(message);
    lastSentAt.set(workspaceId, now);
    return { sent: true, message, result };
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      for (const ws of store.listWorkspaceIds()) {
        run({ workspaceId: ws }).catch((err) => console.error("[reminder] run failed:", err.message));
      }
    }, pollMs);
    if (timer.unref) timer.unref(); // don't keep the process alive on its own
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { preview, run, start, stop };
}
