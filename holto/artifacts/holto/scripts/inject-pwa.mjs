// Post-process the Expo web export (SPA mode) to make it an installable PWA and
// give shared links a proper preview card. Expo's `+html.tsx` is only used for
// static rendering, so we inject the tags into the single generated index.html
// after `expo export`.
//
// Usage: node scripts/inject-pwa.mjs <output-dir>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2];
if (!outDir) {
  console.error("inject-pwa: missing output dir argument");
  process.exit(1);
}

// Absolute base for share-preview URLs (crawlers need absolute og:image/og:url).
const site = (process.env.SITE_URL || "https://app.holtotravel.com").replace(/\/+$/, "");

const indexPath = join(outDir, "index.html");
let html = readFileSync(indexPath, "utf-8");

if (html.includes('rel="manifest"')) {
  console.log("inject-pwa: PWA tags already present, skipping");
  process.exit(0);
}

const title = "HOLTO — honest travel-disruption help";
const description =
  "Know your flight-delay and cancellation rights, and claim the compensation you're owed. Calm, honest guidance the moment things go wrong.";

const tags = [
  // PWA
  '<link rel="manifest" href="/manifest.json" />',
  '<meta name="theme-color" content="#0A2E38" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="apple-mobile-web-app-title" content="HOLTO" />',
  '<link rel="apple-touch-icon" href="/icon.png" />',
  `<meta name="description" content="${description}" />`,
  // Open Graph / Twitter share cards
  `<meta property="og:title" content="${title}" />`,
  `<meta property="og:description" content="${description}" />`,
  '<meta property="og:type" content="website" />',
  `<meta property="og:url" content="${site}/" />`,
  `<meta property="og:image" content="${site}/icon.png" />`,
  '<meta property="og:site_name" content="HOLTO" />',
  '<meta name="twitter:card" content="summary" />',
  `<meta name="twitter:title" content="${title}" />`,
  `<meta name="twitter:description" content="${description}" />`,
  `<meta name="twitter:image" content="${site}/icon.png" />`,
  // Service worker (installability)
  "<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}</script>",
].join("\n    ");

html = html.replace("</head>", `    ${tags}\n  </head>`);
writeFileSync(indexPath, html);
console.log(`inject-pwa: injected PWA + share-card tags (site: ${site}) into`, indexPath);
