// app/(app)/layout.tsx

// The signed-in app's pages (home, audit, requests, searches, plans). Reads the session on
// the server and hands the account to the client components, which show the owner's controls
// to the owner alone, and this month's usage, which the header meter and the upgrade dialog
// read. The proxy has already sent signed-out visitors to sign in.

import type { ReactNode } from 'react';
import { AccountProvider } from '@/app/_shared/components/providers/AccountProvider';
import { UsageProvider } from '@/app/_shared/components/providers/UsageProvider';
import { getSession } from '@/app/_shared/lib/supabase/server';
import { usageSummary } from '@/app/_shared/lib/usage/usage';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const usage = session ? await usageSummary(session.db, session.account) : null;
  return (
    <AccountProvider account={session?.account ?? null}>
      <UsageProvider initial={usage}>{children}</UsageProvider>
    </AccountProvider>
  );
}
