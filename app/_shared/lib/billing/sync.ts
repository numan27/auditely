// app/_shared/lib/billing/sync.ts

// Copies a Stripe subscription onto its account. Callers (the webhook, the return
// from Checkout) hand over only an id, and this reads the subscription back from
// Stripe, so a replayed or out-of-order event can only ever save what Stripe says
// now. The account comes from the subscription's metadata.user_id, which Checkout
// sets; a Checkout session must belong to the account that asks. Server-only.

import type Stripe from 'stripe';
import { fromPrice } from '@/app/_shared/lib/billing/billingRules';
import type { SubscriptionRow } from '@/app/_shared/lib/billing/subscription';
import { saveSubscription, userIdForCustomer } from '@/app/_shared/lib/billing/subscriptionStore';

export type StripeApi = Pick<Stripe, 'subscriptions' | 'checkout'>;
export type SyncResult = 'saved' | 'kept' | 'unmatched' | 'refused';

/** A subscription whose price isn't one of the four Auditely sells; reading it again won't change that */
export class UnknownPrice extends Error {
  constructor(priceId: string) {
    super(`Price ${priceId} isn't one of Auditely's plans`);
    this.name = 'UnknownPrice';
  }
}

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

const customerOf = (sub: Stripe.Subscription) => (typeof sub.customer === 'string' ? sub.customer : sub.customer.id);

/** The subscriptions row for a Stripe subscription; its first item sets the plan and the period */
export function rowFromStripe(sub: Stripe.Subscription, userId: string): SubscriptionRow {
  const item = sub.items.data[0];
  const bought = item ? fromPrice(item.price) : null;
  if (!item || !bought) throw new UnknownPrice(item?.price.id ?? '(none)');
  return {
    user_id: userId,
    plan: bought.plan,
    billing_interval: bought.interval,
    status: sub.status,
    stripe_customer_id: customerOf(sub),
    stripe_subscription_id: sub.id,
    current_period_start: iso(item.current_period_start),
    current_period_end: iso(item.current_period_end),
    period_anchor: iso(sub.billing_cycle_anchor),
    ends_at: sub.cancel_at ? iso(sub.cancel_at) : sub.cancel_at_period_end ? iso(item.current_period_end) : null,
  };
}

/** Saves Stripe's current copy of a subscription to its account */
export async function syncSubscription(stripe: StripeApi, subscriptionId: string, userHint?: string | null): Promise<SyncResult> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const named = sub.metadata?.user_id || null;
  if (named && userHint && named !== userHint) {
    console.error(`[billing] Subscription ${sub.id} names account ${named}, not ${userHint}`);
    return 'refused';
  }
  const userId = named ?? userHint ?? (await userIdForCustomer(customerOf(sub)));
  if (!userId) {
    console.error(`[billing] Subscription ${sub.id} matches no account`);
    return 'unmatched';
  }
  return saveSubscription(rowFromStripe(sub, userId));
}

/** Saves the subscription a finished Checkout bought, when the session is the account's own */
export async function syncCheckoutSession(stripe: StripeApi, sessionId: string, accountId: string): Promise<SyncResult> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const subscription = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (session.client_reference_id !== accountId || session.mode !== 'subscription' || !subscription) return 'refused';
  return syncSubscription(stripe, subscription, accountId);
}
