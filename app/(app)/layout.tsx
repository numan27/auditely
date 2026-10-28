// app/(app)/layout.tsx

// The signed-in app's pages (home, audit, requests, searches, plans, settings). Reads the
// session on the server and hands the account to the client components, which show the
// owner's controls to the owner alone; the current allowance's usage, which the header meter and the
// upgrade dialog read; what the account has connected, which the send buttons and the
// drafts' sign-off read; and the name, company and logo the header's profile menu shows. Everyone signed
// in gets the beta's Feedback button at the bottom right. The proxy has already sent signed-out visitors to sign in, except
// on the home page, which shows them the landing page once sign-ups are open (or /demo).

import type { ReactNode } from 'react';
import { FloatingFeedback } from '@/app/_shared/components/auditely/feedback/floatingFeedback';
import { AccountProvider } from '@/app/_shared/components/providers/AccountProvider';
import { ConnectionsProvider } from '@/app/_shared/components/providers/ConnectionsProvider';
import { ProfileCardProvider } from '@/app/_shared/components/providers/ProfileCardProvider';
import { UsageProvider } from '@/app/_shared/components/providers/UsageProvider';
import { connectionsFor } from '@/app/_shared/lib/settings/connections';
import { profileCardFor } from '@/app/_shared/lib/settings/profileCard';
import { getSession } from '@/app/_shared/lib/supabase/server';
import { usageSummary } from '@/app/_shared/lib/usage/usage';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const [usage, connections, card] = session
    ? await Promise.all([
        usageSummary(session.db, session.account),
        connectionsFor(session.account),
        profileCardFor(session.db, session.account),
      ])
    : [null, null, null];
  return (
    <AccountProvider account={session?.account ?? null}>
      <UsageProvider initial={usage}>
        <ConnectionsProvider connections={connections}>
          <ProfileCardProvider card={card}>
            {children}
            {session && <FloatingFeedback />}
          </ProfileCardProvider>
        </ConnectionsProvider>
      </UsageProvider>
    </AccountProvider>
  );
}
