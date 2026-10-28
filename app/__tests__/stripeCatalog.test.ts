// app/__tests__/stripeCatalog.test.ts

// scripts/stripeSetup.mjs creates Stripe's products and prices from
// scripts/stripeCatalog.mjs, which runs under plain Node and so can't import the
// app's plans. These tests keep the two in step: Checkout charges what the plans
// page shows, under the lookup keys the app asks Stripe for; the webhook hears
// exactly the events it handles; and the billing portal can't sell a plan for less.

import { describe, it, expect } from 'vitest';
import { CATALOG, WEBHOOK_EVENTS_FOR_SETUP, portalFeatures } from '../../scripts/stripeCatalog.mjs';
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

  it('lets a subscriber upgrade at once, and leaves downgrades and shorter billing for the period end', () => {
    const products = [{ product: 'auditely_pro', prices: ['price_1', 'price_2'] }];
    const features = portalFeatures(products);
    expect(features.subscription_update).toEqual({
      enabled: true,
      default_allowed_updates: ['price'],
      products,
      // Neither a downgrade nor a switch to monthly can then reset the allowance or cut the price mid-period
      proration_behavior: 'always_invoice',
      schedule_at_period_end: { conditions: [{ type: 'decreasing_item_amount' }, { type: 'shortening_interval' }] },
    });
    expect(features.subscription_cancel).toEqual({ enabled: true, mode: 'at_period_end' });
    expect(features.customer_update).toEqual({ enabled: true, allowed_updates: ['email', 'address', 'name'] });
    expect([features.invoice_history, features.payment_method_update]).toEqual([{ enabled: true }, { enabled: true }]);
  });

  it('subscribes the webhook to exactly the events it handles', () => {
    expect([...WEBHOOK_EVENTS_FOR_SETUP].sort()).toEqual([...WEBHOOK_EVENTS].sort());
  });
});
