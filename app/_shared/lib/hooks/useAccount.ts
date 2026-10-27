// app/_shared/lib/hooks/useAccount.ts

'use client';

import { createContext, useContext } from 'react';
import type { Account } from '@/app/_shared/lib/auth/account';

export const AccountContext = createContext<Account | null>(null);

/**
 * The signed-in account, or null outside the signed-in app (the public demo).
 * Anything only the owner may use asks this first.
 */
export const useAccount = (): Account | null => useContext(AccountContext);
