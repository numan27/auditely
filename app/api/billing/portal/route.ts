// app/api/billing/portal/route.ts

// Opens Stripe's billing portal for the signed-in account's Stripe customer:
// switching plans or between monthly and yearly, the card, invoices and
// cancelling all happen there, and the webhook brings each change back. It
// returns to Settings, or to the plans page when that's where it was opened.

import { NextRequest, NextResponse } from 'next/server';
import { BILLING_NOT_SET_UP, stripeClient } from '@/app/_shared/lib/billing/stripe';
import { customerIdOf } from '@/app/_shared/lib/billing/subscription';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';

const FAILED = "Couldn't open billing. Try again in a minute.";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const stripe = stripeClient();
  if (!stripe) return NextResponse.json({ error: BILLING_NOT_SET_UP }, { status: 503 });

  const body: unknown = await request.json().catch(() => null);
  const returnTo = (body as { returnTo?: unknown } | null)?.returnTo;
  const origin = request.nextUrl.origin;
  const configuration = process.env.STRIPE_PORTAL_CONFIGURATION?.trim();
  try {
    const customer = await customerIdOf(session.db, session.account.id);
    if (!customer) return NextResponse.json({ error: "There's no billing to manage yet. Choose a plan first." }, { status: 404 });
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: returnTo === 'plans' ? `${origin}${ROUTES.PLANS}` : `${origin}${ROUTES.SETTINGS}#plan`,
      ...(configuration ? { configuration } : {}),
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error('[billing] Failed to open the billing portal:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: FAILED }, { status: 502 });
  }
}
