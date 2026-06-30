import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatReminder,
  shouldSend,
  createReminderService,
  webhookNotifier,
} from "../server/reminders.js";

const summary = (totalDue, decksDue = [], nextDue = null) => ({ totalDue, decksDue, nextDue });

test("formatReminder returns null when nothing is due", () => {
  assert.equal(formatReminder(summary(0)), null);
  assert.equal(formatReminder(null), null);
});

test("formatReminder summarises due decks", () => {
  const msg = formatReminder(summary(3, [{ title: "JP", dueCount: 2 }, { title: "FR", dueCount: 1 }]));
  assert.match(msg.title, /3 cards/);
  assert.match(msg.body, /JP: 2 due/);
  assert.match(msg.body, /FR: 1 due/);
  assert.equal(msg.totalDue, 3);
});

test("formatReminder uses singular wording for one card", () => {
  const msg = formatReminder(summary(1, [{ title: "JP", dueCount: 1 }]));
  assert.match(msg.title, /1 card ready/);
  assert.ok(!/cards/.test(msg.title));
});

test("shouldSend respects minDue and the throttle interval", () => {
  const opts = { minDue: 2, minIntervalMs: 1000 };
  assert.equal(shouldSend(summary(1), null, 5000, opts), false, "below minDue");
  assert.equal(shouldSend(summary(2), null, 5000, opts), true, "no prior send");
  assert.equal(shouldSend(summary(2), 4500, 5000, opts), false, "within interval");
  assert.equal(shouldSend(summary(2), 3000, 5000, opts), true, "interval elapsed");
});

test("service.run sends once then throttles until the interval elapses", async () => {
  const sent = [];
  const store = { dueSummary: () => summary(2, [{ title: "JP", dueCount: 2 }]) };
  const svc = createReminderService({
    store,
    notify: async (m) => { sent.push(m); return { ok: true }; },
    config: { minDue: 1, minIntervalMs: 1000 },
  });

  const first = await svc.run({ now: 0 });
  assert.equal(first.sent, true);
  assert.equal(sent.length, 1);

  const second = await svc.run({ now: 500 }); // within interval
  assert.equal(second.sent, false);
  assert.equal(second.reason, "throttled");
  assert.equal(sent.length, 1);

  const third = await svc.run({ now: 1500 }); // interval elapsed
  assert.equal(third.sent, true);
  assert.equal(sent.length, 2);
});

test("service.run force-sends regardless of throttle, but never when nothing is due", async () => {
  const sent = [];
  let due = 0;
  const store = { dueSummary: () => summary(due, due ? [{ title: "JP", dueCount: due }] : []) };
  const svc = createReminderService({ store, notify: async (m) => sent.push(m), config: { minIntervalMs: 1e9 } });

  assert.equal((await svc.run({ force: true })).sent, false, "nothing due -> no send even when forced");
  due = 1;
  assert.equal((await svc.run({ now: 0 })).sent, true);
  const forced = await svc.run({ now: 1, force: true }); // would be throttled without force
  assert.equal(forced.sent, true);
  assert.equal(sent.length, 2);
});

test("preview reports the pending message without sending", () => {
  const store = { dueSummary: () => summary(2, [{ title: "JP", dueCount: 2 }]) };
  const svc = createReminderService({ store, notify: async () => { throw new Error("should not send"); } });
  const p = svc.preview(0);
  assert.equal(p.wouldSend, true);
  assert.match(p.message.title, /2 cards/);
  assert.equal(p.lastSentAt, null);
});

test("webhookNotifier posts JSON and throws on non-2xx", async () => {
  const calls = [];
  const okFetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200 }; };
  const notify = webhookNotifier("https://hook.example/x", okFetch);
  const res = await notify({ title: "t", body: "b", totalDue: 2 });
  assert.equal(res.delivered, "webhook");
  assert.equal(calls[0].url, "https://hook.example/x");
  assert.deepEqual(JSON.parse(calls[0].opts.body), { title: "t", body: "b", totalDue: 2 });

  const badFetch = async () => ({ ok: false, status: 500 });
  await assert.rejects(webhookNotifier("https://hook.example/x", badFetch)({ title: "t", body: "b" }), /500/);
});
