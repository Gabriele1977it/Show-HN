import { test } from "node:test";
import assert from "node:assert/strict";
import { LANGUAGES, getLanguage, renderLearnPage, renderLearnIndex } from "../server/seo-pages.js";

test("getLanguage looks up by slug case-insensitively", () => {
  assert.equal(getLanguage("spanish").name, "Spanish");
  assert.equal(getLanguage("JAPANESE").name, "Japanese");
  assert.equal(getLanguage("klingon"), null);
  assert.equal(getLanguage(undefined), null);
});

test("a language page has tailored SEO meta, canonical, and CTAs", () => {
  const html = renderLearnPage(getLanguage("spanish"), "https://echodeck.madlabs.uk");
  assert.match(html, /<title>Learn Spanish with real Spanish audio[^<]*<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/echodeck\.madlabs\.uk\/learn\/spanish" \/>/);
  assert.match(html, /<meta name="description" content="[^"]*Spanish[^"]*" \/>/);
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /href="\/demo"/);
  assert.match(html, /href="\/app"/);
  // The native sample sentence is rendered.
  assert.ok(html.includes("practicar español"));
  // No inline <script> (CSP script-src 'self').
  assert.doesNotMatch(html, /<script/);
});

test("language pages cross-link to every other language", () => {
  const html = renderLearnPage(getLanguage("french"), "");
  for (const l of LANGUAGES) {
    if (l.slug === "french") continue;
    assert.match(html, new RegExp(`href="/learn/${l.slug}"`));
  }
  // ...but not to itself in the "other languages" set is not required; just
  // ensure the page is about French.
  assert.match(html, /Learn French/);
});

test("dynamic content is HTML-escaped", () => {
  const html = renderLearnPage({ slug: "x", name: "A<b>C", native: "5>3 & 2<4", gloss: "", sources: "\"quotes\"" }, "");
  assert.match(html, /A&lt;b&gt;C/);
  assert.match(html, /5&gt;3 &amp; 2&lt;4/);
  assert.doesNotMatch(html, /A<b>C/);
});

test("the /learn hub lists every language", () => {
  const html = renderLearnIndex("https://echodeck.madlabs.uk");
  assert.match(html, /<link rel="canonical" href="https:\/\/echodeck\.madlabs\.uk\/learn" \/>/);
  for (const l of LANGUAGES) assert.match(html, new RegExp(`href="/learn/${l.slug}"`));
});
