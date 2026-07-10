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

## Step 2 — Start the Blueprint

1. In Render, click the **New +** button (top right) → **Blueprint**.
2. Find and select your repository (its name may be **`Gabriele1977it/Show-HN`**).
3. **Important — pick the right branch.** There's a branch dropdown. Choose:

   ```
   claude/holto-app-improvements-8cefxv
   ```

   (This is the branch that has HOLTO in it. If you don't choose it, Render won't
   find the setup.)
4. Render will read the plan and show you three things it's about to create:
   - **holto-api** (the backend)
   - **holto-monitor** (the flight-watcher)
   - **holto-db** (the database)
5. Click **Apply**.

That's it for the required steps. Render now builds everything, creates the
database, and **creates the database tables for you automatically**. The first
build takes a few minutes — you can watch the progress bars.

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
     your key. Do the same on **holto-monitor**. Save (it redeploys itself).

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

Render charges per service. A proper always-on setup is roughly:

- holto-api (Starter) ~ $7/mo
- holto-monitor (Starter) ~ $7/mo
- holto-db (Basic 256MB) ~ $6/mo

You can **save money** by deleting the **holto-monitor** service in Render (you'd
lose only the automatic background flight alerts; everything else keeps working).
You can also change any plan later from each service's **Settings**. Render shows
you the price before you confirm — nothing is charged until you click **Apply**.

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
