// app/_shared/lib/billing/subscriptionStore.ts

// Writes each account's subscription, as Stripe has it, with the service role: a
// signed-in user may read their own row and never write one, so nobody can give
// themselves a plan. Stripe's events can arrive late and out of order, so one for
// an older, ended subscription never replaces a live one. Server-only.

import { serviceDb } from '@/app/_shared/lib/supabase/client';
import { isLiveStatus } from '@/app/_shared/lib/billing/billingRules';
import type { SubscriptionRow } from '@/app/_shared/lib/billing/subscription';

const TABLE = 'subscriptions';

type Held = Pick<SubscriptionRow, 'stripe_subscription_id' | 'status'>;

// Postgres's foreign key violation: the row names an account that no longer exists
const NO_ACCOUNT = '23503';

/**
 * Saves the account's subscription; 'kept' when a different live one stays in place, and 'unmatched' when the
 * account was deleted (its subscription is cancelled first, and Stripe's event for that arrives afterwards)
 */
export async function saveSubscription(row: SubscriptionRow): Promise<'saved' | 'kept' | 'unmatched'> {
  const { data, error } = await serviceDb.from(TABLE).select('stripe_subscription_id, status').eq('user_id', row.user_id).maybeSingle();
  if (error) throw new Error(`subscriptions: ${error.message}`);
  const held = data as Held | null;
  if (held && held.stripe_subscription_id !== row.stripe_subscription_id && isLiveStatus(held.status)) {
    if (!isLiveStatus(row.status)) return 'kept';
    console.error(`[billing] ${row.user_id} has two live subscriptions: ${held.stripe_subscription_id} and ${row.stripe_subscription_id}`);
  }
  const { error: saveError } = await serviceDb
    .from(TABLE)
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (saveError?.code === NO_ACCOUNT) {
    console.error(`[billing] Subscription ${row.stripe_subscription_id}'s account ${row.user_id} was deleted, so it isn't saved`);
    return 'unmatched';
  }
  if (saveError) throw new Error(`subscriptions: ${saveError.message}`);
  return 'saved';
}

/** The account a Stripe customer belongs to; null when none does */
export async function userIdForCustomer(customerId: string): Promise<string | null> {
  const { data, error } = await serviceDb.from(TABLE).select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
  if (error) throw new Error(`subscriptions: ${error.message}`);
  return (data?.user_id as string | undefined) ?? null;
}
