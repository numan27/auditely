// scripts/stripeCatalog.mjs

// What scripts/stripeSetup.mjs creates in Stripe: a product per paid plan, each
// with a monthly and a yearly price, and the events the webhook hears. Amounts are
// in cents, before tax. Plain Node runs this file, so it can't import the app's
// plans: app/__tests__/stripeCatalog.test.ts checks it against PLANS, the lookup
// keys and the webhook's events.

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

export const WEBHOOK_EVENTS_FOR_SETUP = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
];
