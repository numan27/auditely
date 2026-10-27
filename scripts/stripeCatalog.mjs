// scripts/stripeCatalog.mjs

// What scripts/stripeSetup.mjs creates in Stripe: a product per paid plan, each
// with a monthly and a yearly price, the billing portal's settings, and the events
// the webhook hears. Amounts are in cents, before tax. Plain Node runs this file,
// so it can't import the app's plans: app/__tests__/stripeCatalog.test.ts checks it
// against PLANS, the lookup keys and the webhook's events.

export const CATALOG = [
  {
    plan: 'pro',
    productId: 'auditely_pro',
    name: 'Auditely Pro',
    prices: [
      { interval: 'month', unitAmount: 2400, lookupKey: 'auditely_pro_monthly' },
      { interval: 'year', unitAmount: 24000, lookupKey: 'auditely_pro_yearly' },
    ],
  },
  {
    plan: 'agency',
    productId: 'auditely_agency',
    name: 'Auditely Agency',
    prices: [
      { interval: 'month', unitAmount: 5900, lookupKey: 'auditely_agency_monthly' },
      { interval: 'year', unitAmount: 59000, lookupKey: 'auditely_agency_yearly' },
    ],
  },
];

/**
 * The billing portal: invoices, the card, the account's details, cancelling at the period end, and switching
 * between the given products' prices. An upgrade is invoiced at once. A downgrade or a switch from yearly to
 * monthly waits for the end of the period paid for: a paid plan's allowances count from its billing anchor,
 * which an interval change resets, so an immediate switch would refill them, and an immediate downgrade would
 * keep the bigger allowance for less.
 */
export function portalFeatures(products) {
  return {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name'] },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      products,
      proration_behavior: 'always_invoice',
      schedule_at_period_end: { conditions: [{ type: 'decreasing_item_amount' }, { type: 'shortening_interval' }] },
    },
  };
}

export const WEBHOOK_EVENTS_FOR_SETUP = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
];
