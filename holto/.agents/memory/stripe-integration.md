---
name: Stripe integration
description: Tier system, product IDs, file layout, and Stripe init pattern for HOLTO
---

## Product IDs (live)
- Trip Pass (7-day): `prod_UVB7qwkiSCZZ83`
- Holto Pro Monthly: `prod_UaMplTUEdQecgV`
- Holto Pro Annual: `prod_UVB94bDPIwFQqY`

## Tier mapping
`PRODUCT_TO_TIER` in `artifacts/api-server/src/lib/tier.ts` maps product IDs → `free | trip_pass | pro`

## Key files
- `artifacts/api-server/src/stripeClient.ts` — Replit connector-based Stripe + StripeSync client
- `artifacts/api-server/src/stripeStorage.ts` — queries against `stripe.*` schema
- `artifacts/api-server/src/lib/tier.ts` — `getUserTier(userId)` and `TIER_FEATURES`
- `artifacts/api-server/src/routes/stripe.ts` — `/api/stripe/tier|products|checkout|portal`
- `artifacts/holto/hooks/useSubscription.ts` — `useSubscription()` + `useStripeProducts()`
- `artifacts/holto/app/subscription.tsx` — full paywall/upgrade screen
- `artifacts/holto/components/PaywallGate.tsx` — gate component wrapping locked features
- `artifacts/holto/constants/tiers.ts` — `TIER_DISPLAY`, `PRODUCT_IDS`

## Init pattern
`initStripe()` in `index.ts` wraps the whole init in try/catch and warns on failure — server starts fine even when Stripe integration is not yet connected.

## Webhook
Registered at `/api/stripe/webhook` BEFORE `express.json()` in `app.ts` — critical ordering.

**Why:** `stripe-replit-sync` requires the raw Buffer payload; if `express.json()` runs first it parses the body and the signature check fails.

## Checkout on mobile
`POST /api/stripe/checkout` returns `{ url }` → Expo app opens via `Linking.openURL()`. Success/cancel land on HTML pages at `/api/stripe/checkout/success` and `/api/stripe/checkout/cancel`. App re-checks tier via `AppState` change listener.

## DB
Users table gained `stripe_customer_id TEXT` (nullable). Migration already applied. No subscription ID stored — tier is determined by querying `stripe.subscriptions` by customer ID.
