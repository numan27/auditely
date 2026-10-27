// app/_shared/components/providers/AccountProvider.tsx

'use client';

import type { ReactNode } from 'react';
import type { Account } from '@/app/_shared/lib/auth/account';
import { AccountContext } from '@/app/_shared/lib/hooks/useAccount';

interface AccountProviderProps {
  /** The signed-in account, read on the server */
  account: Account | null;
  children: ReactNode;
}

/** Tells everything inside it who is signed in, so the owner-only controls show for the owner alone */
export function AccountProvider({ account, children }: AccountProviderProps) {
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}
