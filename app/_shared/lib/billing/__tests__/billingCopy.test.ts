import { describe, it, expect } from 'vitest';
import { subscriptionNote } from '@/app/_shared/lib/billing/billingCopy';

const yearly = {
  plan: 'pro', interval: 'year', status: 'active', anchor: '2026-03-14T09:30:00.000Z', periodEnd: '2027-03-14T09:30:00.000Z', endsAt: null,
} as const;

describe('subscriptionNote', () => {
  it('says when a subscription renews, ends, or needs a new card', () => {
    expect(subscriptionNote(yearly)).toBe("You're on the Pro plan, billed yearly. It renews on Mar 14, 2027.");
    expect(subscriptionNote({ ...yearly, endsAt: '2026-11-14T09:30:00.000Z' })).toBe("You're on the Pro plan until Nov 14, 2026. It won't renew.");
    expect(subscriptionNote({ ...yearly, status: 'past_due' })).toBe(
      "You're on the Pro plan, but the last payment didn't go through. Update your card in Manage billing to keep it."
    );
  });

  it('names a monthly Agency plan', () =>
    expect(subscriptionNote({ ...yearly, plan: 'agency', interval: 'month', periodEnd: '2026-11-14T09:30:00.000Z' })).toBe(
      "You're on the Agency plan, billed monthly. It renews on Nov 14, 2026."
    ));
});
