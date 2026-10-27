// app/_shared/lib/hooks/useConnections.ts

'use client';

import { createContext, useContext } from 'react';
import type { PlanId } from '@/app/_shared/lib/usage/plans';

export { DEMO_CONNECTIONS } from '@/app/_shared/lib/settings/demoConnections';

/** What the signed-in account has set up in Settings: never a password or token */
export interface Connections {
  plan: PlanId;
  /** Has its own name on its emails: the owner, or a paid account with a name or company */
  branded: boolean;
  /** For the drafts' sign-off: the brand's name and the sign-off the AI was given */
  sender: { name: string; signOff: string };
  mailbox: { address: string; source: 'saved' | 'env' } | null;
  hubspot: { source: 'saved' | 'env' } | null;
}

export const ConnectionsContext = createContext<Connections | null>(null);

/** The signed-in account's connections; the demo's, or null outside the app */
export const useConnections = (): Connections | null => useContext(ConnectionsContext);
