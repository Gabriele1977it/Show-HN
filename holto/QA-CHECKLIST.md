# HOLTO — pre-promotion QA checklist

Run this against the **live app** (`app.holtotravel.com`) before letting creators
promote it. ~20–30 minutes. It confirms two things separately: **it works** (no
errors) and **the information is correct** (cross-checked against an authoritative
source). The computed features (rights, cost-of-living maths, best-light, visa
logic, alert escalation, flight-delay derivation) are already covered by 166
automated tests — this list is for the **live data + UI** that only the running
app can prove.

Tip: much of step 1 is one screen.

---

## 1. Pre-flight — the fast status read (2 min)

Open **Admin → Integrations** and **Admin → Live data feeds** (owner account).

- [ ] Every integration you rely on shows a **green dot** (Gemini, AirLabs,
      AeroDataBox, Mapbox, Google, Resend, Stripe, Airalo, AwardWallet).
- [ ] **Live data feeds** show **live** (not "fallback"/"idle") and a recent time
      once each tool has been opened.

If anything's red/fallback, fix it (see `GO-LIVE.md`) before promoting.

---

## 2. Accuracy cross-checks — what a creator will scrutinise

For each, compare HOLTO to the **source of truth**. This is the part that protects
your "information is correct" promise.

- [ ] **Flight status** — track a flight that's **delayed right now** (find one on
      the airline's site or a departures board). In Admin → **Flight status
      debug**, the *live board* row should show the delay, and the card should say
      **Delayed** with the revised time. ↔ cross-check: the airline's own status.
- [ ] **Currency** — convert £100 → USD. ↔ cross-check: Google "100 GBP to USD"
      (should be within a rounding cent; rates are daily).
- [ ] **Best light** — pick a city + today. ↔ cross-check sunrise/sunset:
      timeanddate.com/sun for that city (should match to the minute).
- [ ] **Airport timing** — pick your airport + a flight time. ↔ cross-check the
      drive time against Google Maps for the same route/time.
- [ ] **Weather** — a destination's forecast. ↔ cross-check any weather app.
- [ ] **Travel alerts** — check a **conflict country** (e.g. Israel, Ukraine): it
      must show 🟠/🔴, never green. And a normal country (e.g. Spain) shows green.
      ↔ cross-check: gov.uk/foreign-travel-advice.
- [ ] **Visa & entry** — your passport → a country you know (e.g. UK → Thailand).
      ↔ cross-check the official link it shows.
- [ ] **Cost of living** — London vs a city you know well. Sanity-check the totals
      feel right (they're labelled estimates + a World Bank index).

---

## 3. Functional smoke — every tool opens and returns something (10 min)

Tap through each; expect content, **no error message, no blank screen**:

- [ ] Sign in / sign out (and password reset email arrives)
- [ ] Your travel day · Destination guide · Trips / Add from a booking
- [ ] Airport timing · Best light · Expenses (scan a receipt) · Residency & tax days
- [ ] Cost of living · Currency · Visa & entry · Travel alerts
- [ ] eSIM data plans (plans load) · Loyalty (connect + "Sync")
- [ ] Ask HOLTO — ask 2–3 questions; answers are on-topic and it says "I don't
      have that" rather than inventing when it can't know.
- [ ] Remove a tracked flight (the × works on web) ✔ already fixed

---

## 4. Money paths (5 min)

> **Which card to use depends on your Stripe keys.** With **live** keys
> (`sk_live_…`, what you run in production) the `4242…` test card is *rejected*
> — "your card was declined… known test card." Two ways to test:
> - **Live keys (recommended):** buy the cheapest eSIM with a **real card**,
>   confirm it works, then **refund** yourself in the Stripe dashboard (≈ £0).
>   This is the only way to exercise the real webhook + Airalo fulfilment.
> - **Test keys:** switch Stripe to **Test mode**, put the `sk_test_…` key and
>   the **test** webhook secret on Render, and then `4242 4242 4242 4242` (any
>   future expiry/CVC) works. Switch the live keys back before promoting.

- [ ] **eSIM purchase** — complete a checkout (see the note above for which card).
      You should land on the install screen with a QR, and the sale should appear
      in your **GoAffPro** dashboard.
- [ ] **Pro upgrade** — same flow; account shows the upgraded tier.
- [ ] Confirm the Stripe **webhook** shows delivered events in the Stripe dashboard.

---

## 5. Cross-device

- [ ] Works on **iPhone Safari** and **Android Chrome** (add-to-home-screen PWA).
- [ ] Works on desktop.

---

## The 2-minute creator demo (your happy path)

When it all passes, this is the sequence that shows best on camera:

1. Track a real flight → live status + "when to leave".
2. Open a Destination guide → essentials + weather + an eSIM plan.
3. Cost of living: London vs Bali → the money-goes-further story.
4. Ask HOLTO a question → a crisp, grounded answer.
5. (If you have one) a delayed/cancelled flight → rights + one-tap claim.

---

### Sign-off

- [ ] Sections 1–3 pass → **safe to promote** (accurate + functional).
- [ ] Section 4 passes → monetisation works.
- Re-run sections 1–2 after any deploy.
