// app/api/stripe/webhook/route.ts

// Stripe tells Auditely here when a subscription is bought, changed, paused or
// cancelled. No one is signed in: Stripe's signature, checked against
// STRIPE_WEBHOOK_SECRET, is the key. Each event only names a subscription, which
// syncSubscription reads back from Stripe, so an event that arrives twice or out
// of order saves Stripe's current copy. A sync that fails answers 500, and Stripe
// sends the event again; a subscription that isn't Auditely's is logged and
// acknowledged, since sending it again can't change it.

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { WEBHOOK_EVENTS } from '@/app/_shared/lib/billing/billingRules';
import { BILLING_NOT_SET_UP, stripeClient } from '@/app/_shared/lib/billing/stripe';
import { UnknownPrice, syncSubscription } from '@/app/_shared/lib/billing/sync';

const SUBSCRIPTION_EVENTS = new Set<string>(WEBHOOK_EVENTS.filter((type) => type.startsWith('customer.subscription.')));

/** Syncs the subscription an event is about; other events need nothing */
async function handle(stripe: Stripe, event: Stripe.Event): Promise<void> {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const subscription = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (session.mode === 'subscription' && subscription) await syncSubscription(stripe, subscription, session.client_reference_id);
    return;
  }
  if (SUBSCRIPTION_EVENTS.has(event.type)) await syncSubscription(stripe, (event.data.object as { id: string }).id);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    console.error(`[billing] Stripe's webhook needs ${stripe ? 'STRIPE_WEBHOOK_SECRET' : 'STRIPE_SECRET_KEY'}`);
    return NextResponse.json({ error: BILLING_NOT_SET_UP }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, request.headers.get('stripe-signature') ?? '', secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    await handle(stripe, event);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof UnknownPrice) {
      console.error(`[billing] Ignored ${event.type} ${event.id}: ${message}`);
      return NextResponse.json({ received: true });
    }
    console.error(`[billing] Failed to sync ${event.type} ${event.id}: ${message}`);
    return NextResponse.json({ error: "Couldn't record this event. Stripe will send it again." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
