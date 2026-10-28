// app/_shared/lib/billing/stripe.ts

// The Stripe client, made from STRIPE_SECRET_KEY, the price each plan sells at,
// and each account's one Stripe customer. Without the key billing isn't set up: Checkout and the portal say so, and
// every account stays on Free or its PLAN_OVERRIDES plan. Prices are found by
// their lookup key (auditely_pro_monthly, …), so no price id lives in the code.
// Once sign-ups open in production, a test key turns billing off rather than
// take test payments from real customers. Server-only: the key never reaches the browser.

import Stripe from 'stripe';
import { signupsOpen } from '@/app/_shared/lib/auth/account';
import { isLiveStatus, lookupKey, type BillingInterval, type PaidPlanId } from '@/app/_shared/lib/billing/billingRules';

export const BILLING_NOT_SET_UP = "Billing isn't set up yet. Try again later.";

type StripeEnv = Record<string, string | undefined>;

const clients = new Map<string, Stripe>();

/** Production has opened sign-ups, but STRIPE_SECRET_KEY is still a test-mode key */
export function testKeyAtLaunch(env: StripeEnv = process.env): boolean {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? '';
  return env.VERCEL_ENV === 'production' && signupsOpen(env as NodeJS.ProcessEnv) && key.startsWith('sk_test_');
}

let saidTestKey = false;

/** The client for STRIPE_SECRET_KEY, one per key; null without a key, or with a test key at launch */
export function stripeClient(env: StripeEnv = process.env): Stripe | null {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (testKeyAtLaunch(env)) {
    if (!saidTestKey) {
      saidTestKey = true;
      console.error(
        '[billing] STRIPE_SECRET_KEY is a test key while sign-ups are open in production. Billing is off until the live key is set.'
      );
    }
    return null;
  }
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
  const own = await findCustomer(stripe, account);
  if (own) return own;
  const created = await stripe.customers.create(
    { email: account.email, metadata: { user_id: account.id } },
    { idempotencyKey: `auditely-customer-${account.id}` }
  );
  return created.id;
}

/** The account's own Stripe customer under its email, the one that carries its user_id; null when it has none */
export async function findCustomer(stripe: Stripe, account: { id: string; email: string }): Promise<string | null> {
  const { data } = await stripe.customers.list({ email: account.email, limit: 100 });
  return data.find((customer) => customer.metadata?.user_id === account.id)?.id ?? null;
}

// The only subscriptions that can never bill again
const ENDED = ['canceled', 'incomplete_expired'];

/** Ends every subscription of the customer's that could still bill, at once and with no refund; how many it ended */
export async function cancelSubscriptions(stripe: Stripe, customer: string): Promise<number> {
  const { data } = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 });
  const open = data.filter((subscription) => !ENDED.includes(subscription.status));
  // Stripe's default cancel: no proration and no final invoice, so nothing is refunded or charged
  for (const subscription of open) await stripe.subscriptions.cancel(subscription.id);
  return open.length;
}

/** A subscription of the customer's that still counts, whether or not the webhook has recorded it yet */
export async function liveSubscriptionOf(stripe: Stripe, customer: string): Promise<Stripe.Subscription | null> {
  const { data } = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 });
  return data.find((subscription) => isLiveStatus(subscription.status)) ?? null;
}
