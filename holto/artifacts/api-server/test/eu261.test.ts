import assert from "node:assert/strict";
import { test } from "node:test";

import { calcEU261, getAirportDistance, resolveAirport } from "../src/lib/eu261.ts";

test("resolveAirport matches IATA code and city name", () => {
  assert.equal(resolveAirport("CDG")?.city, "Paris");
  assert.equal(resolveAirport("paris")?.city, "Paris");
  assert.equal(resolveAirport("Nowhere"), null);
});

test("getAirportDistance works for codes and for city names", () => {
  const byCode = getAirportDistance("LHR", "CDG");
  assert.ok(byCode !== null && byCode > 0);
  assert.ok(getAirportDistance("London", "Paris") !== null);
  assert.equal(getAirportDistance("XXX", "YYY"), null);
});

test("short-haul route is the 250 tier", () => {
  const dist = getAirportDistance("LHR", "CDG");
  assert.ok(dist !== null && dist <= 1500);
  assert.equal(calcEU261(dist!, "delay", 3).amount, 250);
});

test("delays under 3 hours are not eligible", () => {
  const r = calcEU261(300, "delay", 2);
  assert.equal(r.eligible, false);
  assert.match(r.reason ?? "", /3 hours/);
});

test("delay of 3h+ is eligible at the distance tier", () => {
  const r = calcEU261(300, "delay", 3);
  assert.equal(r.eligible, true);
  assert.equal(r.amount, 250);
  assert.equal(r.reducedAmount, 125);
});

test("medium-haul cancellation is the 400 tier", () => {
  const r = calcEU261(2000, "cancellation");
  assert.equal(r.eligible, true);
  assert.equal(r.amount, 400);
  assert.match(r.tier, /Medium/);
});

test("long-haul denied boarding is the 600 tier", () => {
  const r = calcEU261(5000, "denied_boarding");
  assert.equal(r.eligible, true);
  assert.equal(r.amount, 600);
});

test("missed connection is punted with an explanation", () => {
  const r = calcEU261(1000, "missed_connection");
  assert.equal(r.eligible, false);
  assert.match(r.reason ?? "", /single ticket/);
});
