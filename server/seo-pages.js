// Per-language SEO landing pages (/learn/:slug).
//
// Static, server-rendered pages targeting organic search ("learn Spanish with
// podcasts", "Japanese shadowing practice", …) that funnel visitors into the
// no-signup demo and the app. Pure render functions (no DOM, no app state) so
// they're unit-testable, and CSP-safe (inline styles only — no inline scripts).

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Each language: a native sample sentence + gloss (shown as a demo card) and a
// short phrase naming the kinds of audio learners actually use.
export const LANGUAGES = [
  { slug: "spanish", name: "Spanish", native: "¿Quieres practicar español todos los días?", gloss: "Do you want to practise Spanish every day?", sources: "telenovelas, news podcasts and reggaetón" },
  { slug: "french", name: "French", native: "On apprend mieux avec ce qu'on aime écouter.", gloss: "You learn better with what you love listening to.", sources: "podcasts, chansons and the evening news" },
  { slug: "german", name: "German", native: "Sprich nach, was Muttersprachler wirklich sagen.", gloss: "Shadow what native speakers really say.", sources: "podcasts, Nachrichten and music" },
  { slug: "italian", name: "Italian", native: "Impara l'italiano dalle voci che ami.", gloss: "Learn Italian from the voices you love.", sources: "podcasts, canzoni and TV" },
  { slug: "portuguese", name: "Portuguese", native: "Aprenda português com áudio de verdade.", gloss: "Learn Portuguese with real audio.", sources: "podcasts, novelas and música" },
  { slug: "japanese", name: "Japanese", native: "毎日少しずつ、本物の日本語で。", gloss: "A little every day, with real Japanese.", sources: "anime, news and podcasts" },
  { slug: "korean", name: "Korean", native: "좋아하는 오디오로 한국어를 배우세요.", gloss: "Learn Korean with the audio you love.", sources: "K-pop, dramas and podcasts" },
  { slug: "chinese", name: "Chinese", native: "用真实的音频学习中文。", gloss: "Learn Chinese with real audio.", sources: "podcasts, news and music" },
  { slug: "english", name: "English", native: "Learn English from the shows you actually watch.", gloss: "", sources: "podcasts, YouTube and TV" },
];

export function getLanguage(slug) {
  return LANGUAGES.find((l) => l.slug === String(slug || "").toLowerCase()) || null;
}

const SHELL_STYLE = `
  :root{--bg:#f7f8fa;--ink:#111827;--ink-2:#374151;--muted:#6b7280;--line:#e5e7eb;--accent:#4f46e5;--accent-weak:#eef2ff;--accent-2:#059669;--radius:16px;--shadow-sm:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.05);--shadow-lg:0 16px 40px rgba(16,24,40,.14);--font:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}
  *{box-sizing:border-box;}body{margin:0;font-family:var(--font);color:var(--ink);background:var(--bg);line-height:1.55;-webkit-font-smoothing:antialiased;}
  a{color:inherit;}
  .hdr{display:flex;align-items:center;justify-content:space-between;max-width:1000px;margin:0 auto;padding:16px 24px;}
  .brand{font-weight:750;font-size:19px;display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;}
  .brand .logo{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,var(--accent),#7c74ff);color:#fff;font-size:15px;}
  .cta{display:inline-flex;align-items:center;justify-content:center;padding:11px 20px;border-radius:11px;font-weight:600;text-decoration:none;font-size:15px;}
  .cta.primary{background:var(--accent);color:#fff;box-shadow:var(--shadow-sm);}.cta.primary:hover{background:#4338ca;}
  .cta.ghost{color:var(--ink-2);border:1px solid var(--line);background:#fff;}
  .hero{max-width:820px;margin:0 auto;padding:56px 24px 24px;text-align:center;}
  .eyebrow{display:inline-block;font-size:12.5px;font-weight:600;color:var(--accent);background:var(--accent-weak);border:1px solid #e0e3ff;padding:5px 13px;border-radius:999px;margin-bottom:20px;}
  h1{font-size:clamp(30px,5.5vw,48px);line-height:1.06;letter-spacing:-1.2px;margin:0 0 16px;}
  h1 .grad{background:linear-gradient(120deg,var(--accent),#a855f7);-webkit-background-clip:text;background-clip:text;color:transparent;}
  .lead{font-size:clamp(16px,2.3vw,19px);color:var(--muted);max-width:620px;margin:0 auto 26px;}
  .ctas{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
  .note{color:var(--muted);font-size:13px;margin-top:14px;}
  .card{max-width:560px;margin:36px auto 0;background:#fff;border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow-lg);padding:22px;text-align:left;}
  .card .native{font-size:20px;}.card .gloss{color:var(--accent-2);margin-top:8px;font-size:15px;}
  .card .meta{color:var(--muted);font-size:12px;margin-top:10px;}
  section{max-width:1000px;margin:0 auto;padding:48px 24px;}
  h2{font-size:clamp(22px,3.5vw,28px);letter-spacing:-.5px;text-align:center;margin:0 0 28px;}
  .feats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}@media(max-width:820px){.feats{grid-template-columns:1fr;}}
  .feat{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow-sm);}
  .feat .ico{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;font-size:18px;background:var(--accent-weak);color:var(--accent);margin-bottom:12px;}
  .feat h3{margin:0 0 6px;font-size:16px;}.feat p{margin:0;color:var(--muted);font-size:14px;}
  .faq{max-width:720px;}.faq details{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px;}
  .faq summary{font-weight:600;cursor:pointer;}.faq p{color:var(--ink-2);}
  .langs{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}
  .langs a{background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 16px;text-decoration:none;font-weight:600;font-size:14px;color:var(--ink-2);}
  .langs a:hover{border-color:var(--accent);color:var(--accent);}
  .foot{max-width:1000px;margin:0 auto;padding:32px 24px;color:var(--muted);font-size:13px;text-align:center;border-top:1px solid var(--line);}
  .foot a{color:var(--muted);text-decoration:none;}
`;

function shell({ title, description, canonical, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta name="robots" content="index,follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:image" content="/og.svg" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/icon.svg" />
    <style>${SHELL_STYLE}</style>
  </head>
  <body>
    <header class="hdr">
      <a class="brand" href="/"><span class="logo">◈</span> EchoDeck</a>
      <a class="cta primary" href="/app" style="padding:9px 16px;font-size:14px">Start free</a>
    </header>
    ${body}
    <footer class="foot">
      © EchoDeck · <a href="/">Home</a> · <a href="/demo">Try the demo</a> · <a href="/learn">All languages</a> · <a href="/privacy">Privacy</a>
    </footer>
  </body>
</html>
`;
}

const FEATURES = [
  ["🎧", "Ingest from anywhere", "Paste a YouTube link, drop in subtitles, or bring your own transcript — every line becomes a card."],
  ["🔁", "Shadowing loops", "Loop each sentence at adjustable speed and speak along until it feels natural."],
  ["🎤", "Pronunciation scoring", "Record yourself and get word-by-word feedback, right in your browser."],
  ["✨", "AI card backs", "One click fills a natural translation plus a short grammar note."],
  ["📊", "Spaced repetition", "An SM-2 scheduler surfaces exactly what's due so nothing slips."],
  ["🛒", "Deck marketplace", "Install community decks, or share your own with your audience."],
];

/** Render a single-language landing page. */
export function renderLearnPage(lang, origin = "") {
  const name = lang.name;
  const title = `Learn ${name} with real ${name} audio — flashcards & shadowing | EchoDeck`;
  const description = `Turn ${name} ${lang.sources} into flashcards and speaking practice. Auto-transcribe, shadow, score your pronunciation and review with spaced repetition. Try it free — no signup.`;
  const feats = FEATURES.map(([ico, h, p]) => `<div class="feat"><div class="ico">${ico}</div><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("");
  const otherLangs = LANGUAGES.filter((l) => l.slug !== lang.slug)
    .map((l) => `<a href="/learn/${l.slug}">${esc(l.name)}</a>`).join("");
  const body = `
    <main class="hero">
      <span class="eyebrow">Learn ${esc(name)} from real audio</span>
      <h1>Learn ${esc(name)} the way <span class="grad">natives actually speak</span></h1>
      <p class="lead">EchoDeck turns the ${esc(name)} ${esc(lang.sources)} you already enjoy into a personal speaking course — timed shadowing drills, smart flashcards, pronunciation scoring and spaced repetition.</p>
      <div class="ctas">
        <a class="cta primary" href="/demo">Try it now — no signup →</a>
        <a class="cta ghost" href="/app">Start free</a>
      </div>
      <p class="note">No signup to try · No credit card required</p>
      <div class="card">
        <div class="native">${esc(lang.native)}</div>
        ${lang.gloss ? `<div class="gloss">${esc(lang.gloss)}</div>` : ""}
        <div class="meta">#1 · ▶ shadow loop · 🎤 pronunciation score</div>
      </div>
    </main>
    <section>
      <h2>Everything you need to study ${esc(name)} from audio</h2>
      <div class="feats">${feats}</div>
    </section>
    <section class="faq">
      <h2>How EchoDeck helps you learn ${esc(name)}</h2>
      <details open><summary>Can I use ${esc(name)} YouTube videos and podcasts?</summary><p>Yes. Paste a YouTube link and EchoDeck pulls its captions, or import an SRT/VTT subtitle file — each line becomes a flashcard with a shadowing loop.</p></details>
      <details><summary>What is shadowing?</summary><p>Shadowing means speaking along with native audio to build your accent and fluency. EchoDeck loops each ${esc(name)} sentence and scores how closely your speech matches.</p></details>
      <details><summary>Do I need an account to try it?</summary><p>No — the <a href="/demo">interactive demo</a> runs in your browser with no signup. Create a free account when you want to save decks and track progress.</p></details>
    </section>
    <section>
      <h2>Study other languages too</h2>
      <div class="langs">${otherLangs}</div>
    </section>
  `;
  return shell({ title, description, canonical: `${origin}/learn/${lang.slug}`, body });
}

/** Render the /learn hub linking to every language page. */
export function renderLearnIndex(origin = "") {
  const title = "Learn a language from real audio — flashcards & shadowing | EchoDeck";
  const description = "Turn podcasts, YouTube and music into flashcards and speaking practice in Spanish, French, Japanese, Korean and more. Try it free — no signup.";
  const langs = LANGUAGES.map((l) => `<a href="/learn/${l.slug}">${esc(l.name)}</a>`).join("");
  const body = `
    <main class="hero">
      <span class="eyebrow">Pick your language</span>
      <h1>Learn any language from the <span class="grad">audio you love</span></h1>
      <p class="lead">Choose a language to see how EchoDeck turns real podcasts, videos and music into flashcards, shadowing drills and pronunciation practice.</p>
      <div class="langs" style="margin-top:22px">${langs}</div>
      <div class="ctas" style="margin-top:26px"><a class="cta primary" href="/demo">Try the demo →</a></div>
    </main>
  `;
  return shell({ title, description, canonical: `${origin}/learn`, body });
}
