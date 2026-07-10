# Putting HOLTO online — the simple version

This guide is written for a non-technical person. It gets HOLTO's backend
(the API, the flight-watcher, and the database) running on **Render**, a hosting
service. You won't need to touch a terminal or write any code.

**Time needed:** ~10 minutes. **What you'll need:** a GitHub account (you have one)
and a card for Render (a proper always-on setup is roughly **£15–20/month** — see
"What it costs" at the end; you won't be charged until you click the final button).

The project is already set up so that almost everything happens automatically.

---

## Step 1 — Create a Render account

1. Go to **https://render.com** and click **Get Started**.
2. Choose **Sign in with GitHub** and approve the connection. This lets Render
   see your `holto-app`… — actually your **`Show-HN`** repository (that's where
   the code lives).

## Step 2 — Add HOLTO as a *separate* Blueprint (won't touch your live apps)

You already have a **MadLabs** Blueprint (running echodeck + madlabs-hub from the
`main` branch). We're going to leave that completely alone and add HOLTO as its
own, second Blueprint that reads a different branch.

1. Go to **Blueprints** in the left menu. Click **New Blueprint Instance** (top right).
2. Select your repository: **`Gabriele1977it / Show-HN`**.
3. **Important — change the branch.** It will probably default to `main`. Use the
   branch selector and pick:

   ```
   claude/holto-app-improvements-8cefxv
   ```

   This is the only step that's easy to miss. If it stays on `main`, Render won't
   find HOLTO. If you don't see a branch selector, send me a screenshot.
4. Render reads the plan and shows what it will create:
   - **holto-api** (the backend — it also runs the flight-watcher inside it)
   - **holto-db** (the database)

   Your existing **echodeck** and **madlabs-hub** are **not** listed here — good,
   that means they're untouched.
5. Click **Apply**.

That's it for the required steps. Render now builds everything, creates the
database, and **creates the database tables for you automatically**. The first
build takes a few minutes — you can watch the progress bars.

> ⚠️ One thing to avoid: don't merge this HOLTO branch into `main` yourself. Doing
> so would confuse your existing MadLabs blueprint. When it's time to tidy
> everything into one place, I'll prepare that carefully so your live apps stay up.

## Step 3 — Get your app's web address

When **holto-api** finishes (it goes green and says "Live"), click it. Near the
top you'll see its address, something like:

```
https://holto-api.onrender.com
```

That's your live backend. You can check it's healthy by opening this in your
browser (it should say `{"status":"ok"}`):

```
https://holto-api.onrender.com/api/healthz
```

**Copy that address and send it to me.** I'll wire the phone app to it and help
with the last touches (see "What's next").

---

## Optional — turn on the "extra" features later

HOLTO **works without these** (you'll still get accounts, rights guidance, and
compensation claims). Add them any time to unlock more:

- **Live flight tracking + alerts** needs an **AirLabs** key (they have a free tier):
  1. Sign up at **https://airlabs.co**, copy your API key.
  2. In Render, open **holto-api** → **Environment** → add `AIRLABS_API_KEY` =
     your key. Save (it redeploys itself). That's it — the flight-watcher runs
     inside holto-api.

- **Warmer, AI-written wording** needs an **OpenAI** key:
  1. Get a key at **https://platform.openai.com**.
  2. In Render, add `OPENAI_API_KEY` to **holto-api** the same way.
  (Without it, HOLTO still shows correct, honest guidance — just in fixed wording.)

- **Web address for the app** (only matters if you use the browser version):
  add `PUBLIC_URL` = your `holto-api` address on **holto-api**.

You don't have to do any of these to go live. Send me the web address and I'll
tell you which ones are worth adding for your launch.

---

## What it costs (so there are no surprises)

This setup is deliberately lean — **two** billable items (the flight monitor now
runs inside the API, so there's no separate paid worker):

- holto-api (Starter, always-on) ~ $7/mo
- holto-db (Basic 256MB, persistent) ~ $6/mo
- **≈ $13/month total.**

Want it cheaper? Two options, both changeable later from each service's
**Settings**:

- **Nearly free:** set **holto-api** to the **Free** instance type. It costs $0 but
  "sleeps" when idle, so the first request after a quiet spell takes ~30–60s to wake.
  Fine for testing; not ideal for a live emergency app.
- **Cheapest database:** Render's **Free** Postgres is $0 but is deleted after ~30
  days. For a real launch, keep the Basic ($6) one, or ask me to switch you to a
  free-forever external database (Neon) — I'll wire it up.

Render always shows the price before you confirm — nothing is charged until you
click **Apply**.

## If something looks stuck

- A service shows **red / "Deploy failed"** → open it, click **Logs**, copy the
  last ~20 lines and send them to me. I'll diagnose and fix it in the code.
- It's the **first ever deploy** and holto-api waits on the database — that's
  normal; give it a few minutes.

## What's next (my part)

Once you send me the `holto-api` web address, I'll:
- point the mobile app at it,
- tell you exactly which optional keys to add for your launch,
- and, when you're ready to publish the phone app, walk you through that too.
