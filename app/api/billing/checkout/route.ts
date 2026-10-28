// app/api/billing/checkout/route.ts

// Opens Stripe Checkout for Pro or Agency, monthly or yearly. Only an account with
// no live subscription buys here, by Auditely's record and by Stripe's, which may
// hold one the webhook hasn't recorded yet; one that already pays switches or
// cancels in Stripe's billing portal. Each account has one Stripe customer, so all
// it buys is in one portal, and an unpaid Checkout closes after an hour. Prices
// exclude tax: Stripe Tax adds US sales tax from the billing address Checkout asks
// for. The subscription carries the account's id, which is how the webhook finds
// whose plan it is. During the beta (checkoutOpen) it turns everyone away before
// Stripe is asked.

import { NextRequest, NextResponse } from 'next/server';
import {
  CHECKOUT_CLOSED,
  INTERVALS,
  PAID_PLANS,
  checkoutOpen,
  fromPrice,
  lookupKey,
  type BillingInterval,
  type PaidPlanId,
} from '@/app/_shared/lib/billing/billingRules';
import { BILLING_NOT_SET_UP, customerFor, liveSubscriptionOf, priceIdFor, stripeClient } from '@/app/_shared/lib/billing/stripe';
import { customerIdOf } from '@/app/_shared/lib/billing/subscription';
import { syncSubscription } from '@/app/_shared/lib/billing/sync';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { PLANS } from '@/app/_shared/lib/usage/plans';

const FAILED = "Couldn't open checkout. Try again in a minute.";
/** Seconds an unpaid Checkout stays open (Stripe allows 30 minutes to 24 hours) */
const CHECKOUT_LIFETIME = 60 * 60;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function alreadyPaying(plan: PaidPlanId | undefined) {
  const error = plan
    ? `You're already on the ${PLANS[plan].name} plan. Change it from Manage billing in Settings.`
    : 'You already have a subscription. Change it from Manage billing in Settings.';
  return NextResponse.json({ error }, { status: 409 });
}

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
  if (!checkoutOpen()) return NextResponse.json({ error: CHECKOUT_CLOSED }, { status: 503 });
  const stripe = stripeClient();
  if (!stripe) return NextResponse.json({ error: BILLING_NOT_SET_UP }, { status: 503 });
  if (account.subscription) return alreadyPaying(account.subscription.plan);

  const origin = request.nextUrl.origin;
  try {
    const key = lookupKey(plan as PaidPlanId, interval as BillingInterval);
    const [price, recorded] = await Promise.all([
      priceIdFor(stripe, plan as PaidPlanId, interval as BillingInterval),
      customerIdOf(session.db, account.id),
    ]);
    if (!price) {
      console.error(`[billing] No active price ${key}: run scripts/stripeSetup.mjs`);
      return NextResponse.json({ error: BILLING_NOT_SET_UP }, { status: 503 });
    }
    const customer = recorded ?? (await customerFor(stripe, account));
    // A second tab, or a click before the webhook has recorded the first purchase
    const live = await liveSubscriptionOf(stripe, customer);
    if (live) {
      await syncSubscription(stripe, live.id, account.id).catch((error) =>
        console.error(`[billing] Couldn't record ${live.id}: ${messageOf(error)}`)
      );
      const item = live.items.data[0];
      return alreadyPaying(item ? fromPrice(item.price)?.plan : undefined);
    }
    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: account.id,
      subscription_data: { metadata: { user_id: account.id } },
      customer,
      customer_update: { address: 'auto', name: 'auto' },
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      success_url: `${origin}${ROUTES.PLANS_DONE}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${ROUTES.PLANS}`,
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_LIFETIME,
    });
    if (!checkout.url) throw new Error('Checkout came back without a URL');
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error('[billing] Failed to open checkout:', messageOf(error));
    return NextResponse.json({ error: FAILED }, { status: 502 });
  }
}
