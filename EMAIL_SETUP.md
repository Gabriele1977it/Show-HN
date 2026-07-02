# Turn on real email (invites & password resets)

By default EchoDeck **logs** emails instead of sending them, so invitations and
password resets show a link in the app but don't land in an inbox. This guide
switches on real sending using **[Resend](https://resend.com)** — the simplest
option, with a free tier that covers a new app (3,000 emails/month).

You'll paste **two values** into Render and you're done. ~10 minutes.

---

## Step 1 — Create a Resend account

1. Go to **[resend.com](https://resend.com)** and click **Sign up** (free).
2. Verify your email and log in.

## Step 2 — (Recommended) Verify your domain

Sending from your own domain (e.g. `hello@madlabs.uk`) means email lands in
inboxes rather than spam.

1. In Resend, open **Domains** → **Add Domain**.
2. Type your domain, e.g. `madlabs.uk`, and click **Add**.
3. Resend shows a few **DNS records** (usually 3: DKIM, SPF, and a return-path).
   Add each one at **IONOS** (where your domain lives):
   - IONOS → **Domains & SSL** → your domain → **DNS**.
   - For each Resend record click **Add record**, choose the **Type** (TXT / CNAME
     / MX as shown), and copy the **Name/Host** and **Value** exactly.
   - Tip: if IONOS auto-appends your domain to the host, paste only the part
     Resend shows *before* your domain (e.g. `resend._domainkey`).
4. Back in Resend click **Verify**. It can take a few minutes to an hour.
   Once every record shows a green tick, you're set.

> **Just testing first?** You can skip domain verification and use the address
> `onboarding@resend.dev` as your sender — but Resend will only deliver those
> test emails **to the email address on your own Resend account**. Fine for a
> quick check; verify your domain before real customers use it.

## Step 3 — Create an API key

1. In Resend open **API Keys** → **Create API Key**.
2. Name it `EchoDeck`, permission **Sending access**, click **Create**.
3. **Copy the key** (starts with `re_…`) — it's shown only once.

## Step 4 — Add the two values to Render

1. Go to **[dashboard.render.com](https://dashboard.render.com)** → your
   **echodeck** service → **Environment** (left menu).
2. Click **Add Environment Variable** and add:
   - **Key:** `RESEND_API_KEY`  **Value:** the `re_…` key from Step 3.
3. **Add Environment Variable** again:
   - **Key:** `EMAIL_FROM`  **Value:** your sender, formatted as
     `EchoDeck <hello@yourdomain.com>` (use your verified domain — or
     `EchoDeck <onboarding@resend.dev>` if you skipped Step 2 for testing).
4. Click **Save Changes**. Render redeploys automatically (1–3 minutes).

## Step 5 — Check it works

1. Open **echodeck.madlabs.uk**, sign in, open the **Workspace** panel, and use
   **Forgot?** on the account form (or invite a member with your own email).
2. The email should arrive within a minute. If it doesn't:
   - Check Resend → **Emails** for the send + any error (a red status usually
     means the domain isn't fully verified yet).
   - Confirm both env vars are set in Render and the service finished redeploying.
   - In the Render **Logs** you should see `Email enabled (resend).` at boot.

---

## Notes

- **Nothing breaks if you skip this.** With no email configured, invites still
  produce a shareable join link and resets still return a link in-app.
- **Prefer another provider?** Set `EMAIL_WEBHOOK_URL` instead of the two Resend
  vars, pointing at any relay that accepts `{ to, subject, text, html }` as JSON
  (Postmark/SendGrid via a small function, Zapier, Make, etc.).
- Resend is chosen only for its simplicity; EchoDeck isn't tied to it.
