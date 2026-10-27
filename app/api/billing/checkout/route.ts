// app/api/billing/checkout/route.ts

// Opens Stripe Checkout for Pro or Agency, monthly or yearly. Only an account with
// no live subscription buys here; one that already pays switches or cancels in
// Stripe's billing portal. Prices exclude tax: Stripe Tax adds US sales tax from
// the billing address Checkout asks for. The subscription carries the account's
// id, which is how the webhook finds whose plan it is.

import { NextRequest, NextResponse } from 'next/server';
import { INTERVALS, PAID_PLANS, lookupKey, type BillingInterval, type PaidPlanId } from '@/app/_shared/lib/billing/billingRules';
import { BILLING_NOT_SET_UP, priceIdFor, stripeClient } from '@/app/_shared/lib/billing/stripe';
import { customerIdOf } from '@/app/_shared/lib/billing/subscription';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { PLANS } from '@/app/_shared/lib/usage/plans';

const FAILED = "Couldn't open checkout. Try again in a minute.";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { account } = session;
  if (account.isOwner) return NextResponse.json({ error: "Your account has no limits, so there's no plan to buy." }, { status: 400 });

  const body: unknown = await request.json().catch(() => null);
  const { plan, interval } = (body ?? {}) as { plan?: unknown; interval?: unknown };
  if (!PAID_PLANS.includes(plan as PaidPlanId) || !INTERVALS.includes(interval as BillingInterval)) {
    return NextResponse.json({ error: 'Choose Pro or Agency, billed monthly or yearly.' }, { status: 400 });
  }
  const stripe = stripeClient();
  if (!stripe) return NextResponse.json({ error: BILLING_NOT_SET_UP }, { status: 503 });
  if (account.subscription) {
    const current = PLANS[account.subscription.plan].name;
    return NextResponse.json({ error: `You're already on the ${current} plan. Change it from Manage billing in Settings.` }, { status: 409 });
  }

  const origin = request.nextUrl.origin;
  try {
    const key = lookupKey(plan as PaidPlanId, interval as BillingInterval);
    const [price, customer] = await Promise.all([
      priceIdFor(stripe, plan as PaidPlanId, interval as BillingInterval),
      customerIdOf(session.db, account.id),
    ]);
    if (!price) {
      console.error(`[billing] No active price ${key}: run scripts/stripeSetup.mjs`);
      return NextResponse.json({ error: BILLING_NOT_SET_UP }, { status: 503 });
    }
    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: account.id,
      subscription_data: { metadata: { user_id: account.id } },
      // A returning customer keeps their Stripe customer, so the portal shows all their invoices
      ...(customer ? { customer, customer_update: { address: 'auto', name: 'auto' } } : { customer_email: account.email }),
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      success_url: `${origin}${ROUTES.PLANS_DONE}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${ROUTES.PLANS}`,
    });
    if (!checkout.url) throw new Error('Checkout came back without a URL');
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error('[billing] Failed to open checkout:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: FAILED }, { status: 502 });
  }
}
