// app/_shared/lib/billing/subscription.ts

// An account's Stripe subscription as the subscriptions table keeps it. The
// caller passes the client: the user's own for their session, the service role's
// for a signed report link that has none. A subscription that can't be read
// counts as none, so the app keeps working, on Free and PLAN_OVERRIDES, until
// the migration has run. Server-only.

import type { Db } from '@/app/_shared/lib/supabase/client';
import { isLive, type BillingInterval, type PaidPlanId, type Subscription } from '@/app/_shared/lib/billing/billingRules';

export const SUBSCRIPTIONS_MIGRATION = 'docs/migrations/2026-10-30-subscriptions.sql';

/** A subscriptions row, minus updated_at; timestamps are ISO strings */
export interface SubscriptionRow {
  user_id: string;
  plan: PaidPlanId;
  billing_interval: BillingInterval;
  status: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  current_period_start: string;
  current_period_end: string;
  period_anchor: string;
  ends_at: string | null;
}

type PlanColumns = Pick<SubscriptionRow, 'plan' | 'billing_interval' | 'status' | 'period_anchor' | 'current_period_end' | 'ends_at'>;

/** Only what the plan needs: the Stripe ids stay on the server */
const PLAN_COLUMNS = 'plan, billing_interval, status, period_anchor, current_period_end, ends_at';

export function toSubscription(row: PlanColumns): Subscription {
  return {
    plan: row.plan,
    interval: row.billing_interval,
    status: row.status,
    anchor: row.period_anchor,
    periodEnd: row.current_period_end,
    endsAt: row.ends_at,
  };
}

/** The account's live subscription; null for none, an ended one, or a table that can't be read */
export async function subscriptionOf(db: Db, userId: string, now: Date = new Date()): Promise<Subscription | null> {
  const { data, error } = await db.from('subscriptions').select(PLAN_COLUMNS).eq('user_id', userId).maybeSingle();
  if (error) {
    console.error(`[billing] Read no subscription for ${userId}: run ${SUBSCRIPTIONS_MIGRATION} in Supabase (${error.message})`);
    return null;
  }
  if (!data) return null;
  const subscription = toSubscription(data as PlanColumns);
  return isLive(subscription, now) ? subscription : null;
}

/** The account's Stripe customer, live subscription or not; throws when it can't be read */
export async function customerIdOf(db: Db, userId: string): Promise<string | null> {
  const { data, error } = await db.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.stripe_customer_id as string | undefined) ?? null;
}
