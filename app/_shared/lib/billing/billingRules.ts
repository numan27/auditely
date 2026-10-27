// app/_shared/lib/billing/billingRules.ts

// What a Stripe subscription means for an account: which plan it buys, whether
// it still counts, and the monthly windows its allowances are counted in. A
// paid plan's months start on its billing anchor (the day it was bought, or the
// day it last switched between monthly and yearly), so a yearly plan gets twelve
// separate months. Client-safe: no server imports.

export type PaidPlanId = 'pro' | 'agency';
export type BillingInterval = 'month' | 'year';

export const PAID_PLANS: readonly PaidPlanId[] = ['pro', 'agency'];
export const INTERVALS: readonly BillingInterval[] = ['month', 'year'];

export interface Subscription {
  plan: PaidPlanId;
  interval: BillingInterval;
  /** Stripe's status: active, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired, paused */
  status: string;
  /** Stripe's billing cycle anchor (ISO): the monthly allowance windows count from it */
  anchor: string;
  /** The end of the period paid for (ISO) */
  periodEnd: string;
  /** When a cancelled subscription stops (ISO); null while it renews */
  endsAt: string | null;
}

/** past_due keeps the plan while Stripe retries the card */
export const LIVE_STATUSES: readonly string[] = ['active', 'trialing', 'past_due'];

/** Days a subscription stays live past its period end, so a late renewal webhook doesn't drop it */
export const GRACE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isLiveStatus(status: string): boolean {
  return LIVE_STATUSES.includes(status);
}

export function isLive(sub: Pick<Subscription, 'status' | 'periodEnd'>, now: Date): boolean {
  return isLiveStatus(sub.status) && now.getTime() < new Date(sub.periodEnd).getTime() + GRACE_DAYS * DAY_MS;
}

/** The anchor moved `months` months on, on the anchor's day (or the month's last) at the anchor's time, UTC */
function addMonths(anchor: Date, months: number): Date {
  const target = anchor.getUTCMonth() + months;
  const year = anchor.getUTCFullYear() + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(anchor.getUTCDate(), lastDay),
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds()
    )
  );
}

/** The window of whole months from `anchor` that `now` falls in */
export function monthlyWindow(anchor: Date, now: Date): { start: Date; end: Date } {
  let months = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth());
  if (addMonths(anchor, months) > now) months -= 1;
  return { start: addMonths(anchor, months), end: addMonths(anchor, months + 1) };
}

const INTERVAL_WORD: Record<BillingInterval, string> = { month: 'monthly', year: 'yearly' };

/** The Stripe price's lookup key for a plan and interval: auditely_pro_monthly, … */
export function lookupKey(plan: PaidPlanId, interval: BillingInterval): string {
  return `auditely_${plan}_${INTERVAL_WORD[interval]}`;
}

/** The Stripe product a paid plan's prices belong to: auditely_pro, auditely_agency (scripts/stripeCatalog.mjs) */
export function productId(plan: PaidPlanId): string {
  return `auditely_${plan}`;
}

/**
 * What a Stripe price bills: the plan from its product, the interval from its recurrence. Not from its lookup
 * key: that moves to the new price when a price changes, and subscriptions on the old one keep their plan.
 */
export function fromPrice(price: {
  product: string | { id: string } | null;
  recurring: { interval: string } | null;
}): { plan: PaidPlanId; interval: BillingInterval } | null {
  const product = typeof price.product === 'string' ? price.product : price.product?.id;
  const plan = PAID_PLANS.find((id) => productId(id) === product);
  const interval = INTERVALS.find((id) => id === price.recurring?.interval);
  return plan && interval ? { plan, interval } : null;
}

/** The Stripe events the webhook handles, and the setup script subscribes it to */
export const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
] as const;
