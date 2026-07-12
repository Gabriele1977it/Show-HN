import assert from "node:assert/strict";
import { test } from "node:test";
import zlib from "node:zlib";

import { extractPdfText } from "../src/lib/pdf-text.ts";

function pdfWithFlateContent(content: string): Buffer {
  const deflated = zlib.deflateSync(Buffer.from(content, "latin1"));
  return Buffer.concat([
    Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${deflated.length} /Filter /FlateDecode >>\nstream\n`, "latin1"),
    deflated,
    Buffer.from("\nendstream\nendobj\n", "latin1"),
  ]);
}

test("extracts text from a FlateDecode content stream", () => {
  const pdf = pdfWithFlateContent("BT /F1 12 Tf (Hello World) Tj ET");
  assert.match(extractPdfText(pdf), /Hello World/);
});

test("extracts across multiple text runs (TJ / newlines)", () => {
  const content = "BT (Flight BA503) Tj (LHR to LIS) Tj (15 Aug 14:30) Tj ET";
  const pdf = pdfWithFlateContent(content);
  const out = extractPdfText(pdf);
  assert.match(out, /Flight BA503/);
  assert.match(out, /LHR to LIS/);
  assert.match(out, /15 Aug 14:30/);
});

test("decodes hex strings", () => {
  // "Hi" = 48 69
  const pdf = pdfWithFlateContent("BT <4869> Tj ET");
  assert.match(extractPdfText(pdf), /Hi/);
});

test("skips image streams", () => {
  const deflated = zlib.deflateSync(Buffer.from("BT (should not appear) Tj ET", "latin1"));
  const pdf = Buffer.concat([
    Buffer.from(`1 0 obj\n<< /Subtype /Image /Filter /FlateDecode /Length ${deflated.length} >>\nstream\n`, "latin1"),
    deflated,
    Buffer.from("\nendstream\nendobj\n", "latin1"),
  ]);
  assert.doesNotMatch(extractPdfText(pdf), /should not appear/);
});

test("returns empty string when there is no text content", () => {
  assert.equal(extractPdfText(Buffer.from("%PDF-1.4\nno streams here\n", "latin1")), "");
});

test("handles balanced parentheses inside a literal", () => {
  const pdf = pdfWithFlateContent("BT (Ref (ABC123) ok) Tj ET");
  assert.match(extractPdfText(pdf), /Ref \(ABC123\) ok/);
});
