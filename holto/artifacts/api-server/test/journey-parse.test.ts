import assert from "node:assert/strict";
import { test } from "node:test";

import { extractFlightNumber, extractRoute } from "../src/lib/journey-parse.ts";

test("extracts a standard flight number", () => {
  assert.equal(extractFlightNumber("BA503 LHR → LIS"), "BA503");
});

test("extracts a 3-letter airline code flight number", () => {
  assert.equal(extractFlightNumber("EZY8743 to Faro"), "EZY8743");
});

test("extracts a letter+digit airline code flight number", () => {
  assert.equal(extractFlightNumber("Flight U28743"), "U28743");
});

test("is case-insensitive", () => {
  assert.equal(extractFlightNumber("ba503 lhr to lis"), "BA503");
});

test("returns null when there is no flight number", () => {
  assert.equal(extractFlightNumber("Hotel Ritz check-in"), null);
});

test("extracts a route with an arrow", () => {
  assert.deepEqual(extractRoute("BA503 LHR → LIS"), { dep: "LHR", arr: "LIS" });
});

test("extracts a route with 'to'", () => {
  assert.deepEqual(extractRoute("LHR to LIS"), { dep: "LHR", arr: "LIS" });
});

test("returns nulls when no route is present", () => {
  assert.deepEqual(extractRoute("BA503 morning flight"), { dep: null, arr: null });
});
