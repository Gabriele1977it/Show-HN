import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";

import { db, usersTable } from "@workspace/db";

export class StripeStorage {
  async getUser(id: number) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user ?? null;
  }

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    return user ?? null;
  }

  async setStripeCustomerId(userId: number, stripeCustomerId: string) {
    const [user] = await db
      .update(usersTable)
      .set({ stripeCustomerId })
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.stripeCustomerId, stripeCustomerId));
    return user ?? null;
  }

  async setTripPassExpiry(userId: number, expiresAt: Date) {
    const [user] = await db
      .update(usersTable)
      .set({ tripPassExpiresAt: expiresAt })
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }

  async getActiveSubscriptionByCustomer(stripeCustomerId: string) {
    const result = await db.execute(sql`
      SELECT
        s.id,
        s.status,
        s.current_period_end,
        s.cancel_at_period_end,
        pr.product as product_id
      FROM stripe.subscriptions s
      JOIN stripe.subscription_items si ON si.subscription = s.id
      JOIN stripe.prices pr ON pr.id = si.price
      WHERE s.customer = ${stripeCustomerId}
        AND s.status = 'active'
      ORDER BY s.created DESC
      LIMIT 1
    `);
    return (result.rows[0] as {
      id: string;
      status: string;
      current_period_end: number;
      cancel_at_period_end: boolean;
      product_id: string;
    } | undefined) ?? null;
  }

  async listProductsWithPrices() {
    const result = await db.execute(sql`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.description AS product_description,
        p.metadata AS product_metadata,
        pr.id AS price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active AS price_active
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount ASC
    `);
    return result.rows as Array<{
      product_id: string;
      product_name: string;
      product_description: string | null;
      product_metadata: Record<string, string> | null;
      price_id: string | null;
      unit_amount: number | null;
      currency: string | null;
      recurring: { interval: string; interval_count: number } | null;
      price_active: boolean | null;
    }>;
  }
}

export const stripeStorage = new StripeStorage();
