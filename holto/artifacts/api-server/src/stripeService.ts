import { getUncachableStripeClient } from "./stripeClient";

export class StripeService {
  async createCustomer(email: string, userId: number) {
    const stripe = await getUncachableStripeClient();
    return stripe.customers.create({ email, metadata: { userId: String(userId) } });
  }

  async createCheckoutSession(opts: {
    customerId: string;
    priceId: string;
    mode: "subscription" | "payment";
    successUrl: string;
    cancelUrl: string;
  }) {
    const stripe = await getUncachableStripeClient();
    return stripe.checkout.sessions.create({
      customer: opts.customerId,
      payment_method_types: ["card"],
      line_items: [{ price: opts.priceId, quantity: 1 }],
      mode: opts.mode,
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
    });
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  }
}

export const stripeService = new StripeService();
