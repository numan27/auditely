// app/_shared/lib/billing/stripe.ts

// The Stripe client, made from STRIPE_SECRET_KEY, the price each plan sells at,
// and each account's one Stripe customer. Without the key billing isn't set up: Checkout and the portal say so, and
// every account stays on Free or its PLAN_OVERRIDES plan. Prices are found by
// their lookup key (auditely_pro_monthly, …), so no price id lives in the code.
// Server-only: the key never reaches the browser.

import Stripe from 'stripe';
import { isLiveStatus, lookupKey, type BillingInterval, type PaidPlanId } from '@/app/_shared/lib/billing/billingRules';

export const BILLING_NOT_SET_UP = "Billing isn't set up yet. Try again later.";

type StripeEnv = Record<string, string | undefined>;

const clients = new Map<string, Stripe>();

/** The client for STRIPE_SECRET_KEY, one per key; null without a key */
export function stripeClient(env: StripeEnv = process.env): Stripe | null {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  let client = clients.get(key);
  if (!client) {
    client = new Stripe(key);
    clients.set(key, client);
  }
  return client;
}

export function billingReady(env: StripeEnv = process.env): boolean {
  return stripeClient(env) !== null;
}

/** The active price for a plan and interval, by its lookup key; null when Stripe has none */
export async function priceIdFor(stripe: Stripe, plan: PaidPlanId, interval: BillingInterval): Promise<string | null> {
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey(plan, interval)], active: true, limit: 1 });
  return data[0]?.id ?? null;
}

/**
 * The account's Stripe customer before it has a subscription row: the one under its email that carries its
 * user_id, or a new one. The idempotency key gives two Checkouts opened at once the same new customer.
 */
export async function customerFor(stripe: Stripe, account: { id: string; email: string }): Promise<string> {
  const { data } = await stripe.customers.list({ email: account.email, limit: 100 });
  const own = data.find((customer) => customer.metadata?.user_id === account.id);
  if (own) return own.id;
  const created = await stripe.customers.create(
    { email: account.email, metadata: { user_id: account.id } },
    { idempotencyKey: `auditely-customer-${account.id}` }
  );
  return created.id;
}

/** A subscription of the customer's that still counts, whether or not the webhook has recorded it yet */
export async function liveSubscriptionOf(stripe: Stripe, customer: string): Promise<Stripe.Subscription | null> {
  const { data } = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 });
  return data.find((subscription) => isLiveStatus(subscription.status)) ?? null;
}
