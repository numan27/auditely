// app/(app)/layout.tsx

// The signed-in app's pages (home, audit, requests, searches, plans, settings). Reads the
// session on the server and hands the account to the client components, which show the
// owner's controls to the owner alone; the current allowance's usage, which the header meter and the
// upgrade dialog read; and what the account has connected, which the send buttons and the
// drafts' sign-off read. The proxy has already sent signed-out visitors to sign in, except
// on the home page, which shows them the landing page once sign-ups are open (or /demo).

import type { ReactNode } from 'react';
import { AccountProvider } from '@/app/_shared/components/providers/AccountProvider';
import { ConnectionsProvider } from '@/app/_shared/components/providers/ConnectionsProvider';
import { UsageProvider } from '@/app/_shared/components/providers/UsageProvider';
import { connectionsFor } from '@/app/_shared/lib/settings/connections';
import { getSession } from '@/app/_shared/lib/supabase/server';
import { usageSummary } from '@/app/_shared/lib/usage/usage';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const [usage, connections] = session
    ? await Promise.all([usageSummary(session.db, session.account), connectionsFor(session.account)])
    : [null, null];
  return (
    <AccountProvider account={session?.account ?? null}>
      <UsageProvider initial={usage}>
        <ConnectionsProvider connections={connections}>{children}</ConnectionsProvider>
      </UsageProvider>
    </AccountProvider>
  );
}
