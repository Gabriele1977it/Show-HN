// Post-process the Expo web export (SPA mode) to make it an installable PWA.
// Expo's `+html.tsx` is only used for static rendering, so instead we inject the
// PWA <head> tags into the single generated index.html after `expo export`.
//
// Usage: node scripts/inject-pwa.mjs <output-dir>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2];
if (!outDir) {
  console.error("inject-pwa: missing output dir argument");
  process.exit(1);
}

const indexPath = join(outDir, "index.html");
let html = readFileSync(indexPath, "utf-8");

if (html.includes('rel="manifest"')) {
  console.log("inject-pwa: PWA tags already present, skipping");
  process.exit(0);
}

const description =
  "Know your flight-delay and cancellation rights, and claim the compensation you're owed. Calm, honest guidance the moment things go wrong.";

const tags = [
  '<link rel="manifest" href="/manifest.json" />',
  '<meta name="theme-color" content="#0A2E38" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="apple-mobile-web-app-title" content="HOLTO" />',
  `<meta name="description" content="${description}" />`,
  '<link rel="apple-touch-icon" href="/icon.png" />',
  "<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}</script>",
].join("\n    ");

html = html.replace("</head>", `    ${tags}\n  </head>`);
writeFileSync(indexPath, html);
console.log("inject-pwa: injected PWA tags into", indexPath);
