import assert from "node:assert/strict";
import { test } from "node:test";

import { buildTripRecap, type RecapItem } from "../src/lib/trip-recap.ts";

function item(p: Partial<RecapItem>): RecapItem {
  return { type: "activity", title: "x", location: null, startAt: null, ...p };
}

test("counts flights, stays and activities by type", () => {
  const r = buildTripRecap({
    startDate: null,
    endDate: null,
    destination: null,
    items: [item({ type: "flight" }), item({ type: "flight" }), item({ type: "hotel" }), item({ type: "activity" })],
  });
  assert.equal(r.flights, 2);
  assert.equal(r.stays, 1);
  assert.equal(r.activities, 1);
});

test("days come from explicit start/end dates inclusive", () => {
  const r = buildTripRecap({ startDate: "2026-08-01", endDate: "2026-08-07", destination: null, items: [] });
  assert.equal(r.days, 7);
});

test("days fall back to the item timeline span", () => {
  const r = buildTripRecap({
    startDate: null,
    endDate: null,
    destination: null,
    items: [item({ startAt: "2026-08-01T09:00:00Z" }), item({ startAt: "2026-08-03T18:00:00Z" })],
  });
  assert.equal(r.days, 3);
});

test("distinct cities and countries are derived from 'City, Country' strings", () => {
  const r = buildTripRecap({
    startDate: null,
    endDate: null,
    destination: null,
    items: [
      item({ location: "Lisbon, Portugal" }),
      item({ location: "Porto, Portugal" }),
      item({ location: "Madrid, Spain" }),
    ],
  });
  assert.equal(r.places, 3);
  assert.equal(r.countries, 2);
  assert.deepEqual(r.cities, ["Lisbon", "Porto", "Madrid"]);
});

test("bare city names count as places with zero countries", () => {
  const r = buildTripRecap({ startDate: null, endDate: null, destination: null, items: [item({ location: "Bali" })] });
  assert.equal(r.places, 1);
  assert.equal(r.countries, 0);
});

test("duplicate cities are de-duplicated case-insensitively", () => {
  const r = buildTripRecap({
    startDate: null,
    endDate: null,
    destination: "lisbon",
    items: [item({ location: "Lisbon" }), item({ location: "LISBON, Portugal" })],
  });
  assert.equal(r.places, 1);
});

test("empty trip yields null days and zero counts", () => {
  const r = buildTripRecap({ startDate: null, endDate: null, destination: null, items: [] });
  assert.equal(r.days, null);
  assert.equal(r.flights, 0);
  assert.equal(r.places, 0);
});
