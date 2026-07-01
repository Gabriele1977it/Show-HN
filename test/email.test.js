import { test } from "node:test";
import assert from "node:assert/strict";
import { createMailer } from "../server/email.js";

test("dev mode logs and reports console delivery", async () => {
  const logs = [];
  const mailer = createMailer({ log: (m) => logs.push(m) });
  assert.equal(mailer.enabled, false);
  const r = await mailer.send({ to: "a@b.com", subject: "Hi", text: "body" });
  assert.equal(r.delivered, "console");
  assert.match(logs[0], /a@b\.com/);
});

test("webhook mode POSTs JSON and throws on non-2xx", async () => {
  const calls = [];
  const okFetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200 }; };
  const mailer = createMailer({ webhookUrl: "https://mail.example/send", fetchImpl: okFetch });
  assert.equal(mailer.enabled, true);
  const r = await mailer.send({ to: "x@y.com", subject: "S", text: "T", html: "<b>T</b>" });
  assert.equal(r.delivered, "webhook");
  assert.equal(calls[0].url, "https://mail.example/send");
  assert.deepEqual(JSON.parse(calls[0].opts.body), { to: "x@y.com", subject: "S", text: "T", html: "<b>T</b>" });

  const badFetch = async () => ({ ok: false, status: 500 });
  await assert.rejects(createMailer({ webhookUrl: "https://mail.example/send", fetchImpl: badFetch }).send({ to: "x", subject: "s", text: "t" }), /500/);
});
