// app/(app)/plans/page.tsx

// The account's plan, this month's usage and what each plan includes. Payments
// come later: until then the paid plans say "Coming soon".

import type { Metadata } from 'next';
import { AppHeader } from '@/app/_shared/components/auditely/appHeader/appHeader';
import { PlansView } from '@/app/_shared/components/auditely/plansView/plansView';
import { getSession } from '@/app/_shared/lib/supabase/server';
import { usageSummary } from '@/app/_shared/lib/usage/usage';

export const metadata: Metadata = { title: 'Plans' };

export default async function PlansPage() {
  const session = await getSession();
  const summary = session ? await usageSummary(session.db, session.account) : null;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
        <PlansView summary={summary} />
      </main>
    </div>
  );
}
