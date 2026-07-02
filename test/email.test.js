import { test } from "node:test";
import assert from "node:assert/strict";
import { createMailer } from "../server/email.js";

test("dev mode logs and reports console delivery", async () => {
  const logs = [];
  const mailer = createMailer({ log: (m) => logs.push(m) });
  assert.equal(mailer.enabled, false);
  assert.equal(mailer.mode, "dev");
  const r = await mailer.send({ to: "a@b.com", subject: "Hi", text: "body" });
  assert.equal(r.delivered, "console");
  assert.match(logs[0], /a@b\.com/);
});

test("resend mode posts to the Resend API with auth + from, throws on error", async () => {
  const calls = [];
  const okFetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200 }; };
  const mailer = createMailer({ apiKey: "re_test", from: "EchoDeck <hi@echodeck.dev>", fetchImpl: okFetch });
  assert.equal(mailer.mode, "resend");
  assert.equal(mailer.enabled, true);
  const r = await mailer.send({ to: "u@v.com", subject: "S", text: "T", html: "<b>T</b>" });
  assert.equal(r.delivered, "resend");
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.match(calls[0].opts.headers.Authorization, /Bearer re_test/);
  assert.deepEqual(JSON.parse(calls[0].opts.body), { from: "EchoDeck <hi@echodeck.dev>", to: "u@v.com", subject: "S", text: "T", html: "<b>T</b>" });

  const badFetch = async () => ({ ok: false, status: 422, json: async () => ({ message: "domain not verified" }) });
  await assert.rejects(
    createMailer({ apiKey: "re_test", from: "x@y.com", fetchImpl: badFetch }).send({ to: "a", subject: "s", text: "t" }),
    /Resend responded 422: domain not verified/,
  );
});

test("resend takes priority over a webhook when both are set", () => {
  const mailer = createMailer({ apiKey: "re_test", from: "a@b.com", webhookUrl: "https://relay.example/send" });
  assert.equal(mailer.mode, "resend");
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
