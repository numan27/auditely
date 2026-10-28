// app/(app)/plans/page.tsx

// The account's plan, this month's usage and what each plan includes, with the
// way to buy Pro or Agency (Stripe Checkout) or manage a plan already bought (the
// billing portal). ?billing=yearly picks yearly prices; Checkout comes back with
// ?subscribed=1.

import type { Metadata } from 'next';
import { AppHeader } from '@/app/_shared/components/auditely/appHeader/appHeader';
import { PlansView, type PlansBilling } from '@/app/_shared/components/auditely/plansView/plansView';
import { billingReady } from '@/app/_shared/lib/billing/stripe';
import { getSession } from '@/app/_shared/lib/supabase/server';
import { usageSummary } from '@/app/_shared/lib/usage/usage';

export const metadata: Metadata = { title: 'Plans' };

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const summary = session ? await usageSummary(session.db, session.account) : null;
  const billing: PlansBilling = {
    ready: billingReady(),
    canBuy: !!session && !session.account.isOwner,
    subscription: session?.account.subscription ?? null,
    interval: params.billing === 'yearly' ? 'year' : 'month',
    justSubscribed: params.subscribed === '1',
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
        <PlansView summary={summary} billing={billing} />
      </main>
    </div>
  );
}
