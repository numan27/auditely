// app/__tests__/stripeCatalog.test.ts

// scripts/stripeSetup.mjs creates Stripe's products and prices from
// scripts/stripeCatalog.mjs, which runs under plain Node and so can't import the
// app's plans. These tests keep the two in step: Checkout charges what the plans
// page shows, under the lookup keys the app asks Stripe for, and the webhook hears
// exactly the events it handles.

import { describe, it, expect } from 'vitest';
import { CATALOG, WEBHOOK_EVENTS_FOR_SETUP } from '../../scripts/stripeCatalog.mjs';
import { PAID_PLANS, WEBHOOK_EVENTS, lookupKey, productId, type PaidPlanId } from '@/app/_shared/lib/billing/billingRules';
import { PLANS } from '@/app/_shared/lib/usage/plans';

describe('Stripe catalog', () => {
  it("charges what the plans page shows, under the app's lookup keys", () => {
    expect(CATALOG.map((p) => p.plan)).toEqual(PAID_PLANS);
    // The products are how a subscription's plan is read back, whatever its price's lookup key
    expect(CATALOG.map((p) => p.productId)).toEqual(PAID_PLANS.map(productId));
    for (const { plan, prices } of CATALOG) {
      // The .mjs catalog's plan infers as string under tsc
      const id = plan as PaidPlanId;
      expect(prices).toEqual([
        { interval: 'month', unitAmount: PLANS[id].monthlyPrice! * 100, lookupKey: lookupKey(id, 'month') },
        { interval: 'year', unitAmount: PLANS[id].yearlyPrice! * 100, lookupKey: lookupKey(id, 'year') },
      ]);
    }
  });

  it('subscribes the webhook to exactly the events it handles', () => {
    expect([...WEBHOOK_EVENTS_FOR_SETUP].sort()).toEqual([...WEBHOOK_EVENTS].sort());
  });
});
