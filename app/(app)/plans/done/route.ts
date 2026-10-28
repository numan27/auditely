// app/(app)/plans/done/route.ts

// Where Checkout sends the buyer back. The subscription is saved here as well as
// by the webhook, so the plans page shows the new plan straight away; the session
// must be this account's own (syncCheckoutSession checks). Whatever happens, the
// buyer lands on the plans page, and the webhook catches anything missed here.

import { NextRequest, NextResponse } from 'next/server';
import { stripeClient } from '@/app/_shared/lib/billing/stripe';
import { syncCheckoutSession } from '@/app/_shared/lib/billing/sync';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { getSession } from '@/app/_shared/lib/supabase/server';

// Stripe's Checkout session ids; anything else is never sent to Stripe
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(ROUTES.LOGIN, request.url));

  const id = request.nextUrl.searchParams.get('session_id') ?? '';
  const stripe = stripeClient();
  if (stripe && SESSION_ID.test(id)) {
    try {
      await syncCheckoutSession(stripe, id, session.account.id);
    } catch (error) {
      console.error(`[billing] Failed to save Checkout ${id}:`, error instanceof Error ? error.message : String(error));
    }
  }
  return NextResponse.redirect(new URL(`${ROUTES.PLANS}?subscribed=1`, request.url), 303);
}
