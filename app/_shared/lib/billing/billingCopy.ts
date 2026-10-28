// app/_shared/lib/billing/billingCopy.ts

// The words for an account's subscription in Settings: when it renews, when it
// stops, or that its last payment failed. Client-safe.

import type { Subscription } from '@/app/_shared/lib/billing/billingRules';
import { PLANS } from '@/app/_shared/lib/usage/plans';
import { formatBillingDate } from '@/app/_shared/lib/usage/usageCopy';

const BILLED: Record<Subscription['interval'], string> = { month: 'monthly', year: 'yearly' };

export function subscriptionNote(sub: Subscription): string {
  const name = PLANS[sub.plan].name;
  if (sub.status === 'past_due') {
    return `You're on the ${name} plan, but the last payment didn't go through. Update your card in Manage billing to keep it.`;
  }
  if (sub.endsAt) return `You're on the ${name} plan until ${formatBillingDate(sub.endsAt)}. It won't renew.`;
  return `You're on the ${name} plan, billed ${BILLED[sub.interval]}. It renews on ${formatBillingDate(sub.periodEnd)}.`;
}
