import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

function getStripeCredentials(): { secretKey: string; webhookSecret?: string } {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY environment variable is not set. " +
        "Add your Stripe secret key (sk_live_...) as a secret in the Replit Secrets tab.",
    );
  }
  return {
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  };
}

export function getUncachableStripeClient(): Stripe {
  const { secretKey } = getStripeCredentials();
  return new Stripe(secretKey);
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL environment variable is required");

  const { secretKey, webhookSecret } = getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? "",
  });
}
