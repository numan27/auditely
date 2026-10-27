// app/(app)/layout.tsx

// The signed-in app's pages (home, audit, requests, searches). Reads the session on the
// server and hands the account to the client components, which show the owner's controls
// to the owner alone. The proxy has already sent signed-out visitors to sign in.

import type { ReactNode } from 'react';
import { AccountProvider } from '@/app/_shared/components/providers/AccountProvider';
import { getSession } from '@/app/_shared/lib/supabase/server';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return <AccountProvider account={session?.account ?? null}>{children}</AccountProvider>;
}
