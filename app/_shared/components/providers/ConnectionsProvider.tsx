// app/_shared/components/providers/ConnectionsProvider.tsx

'use client';

import type { ReactNode } from 'react';
import { ConnectionsContext, type Connections } from '@/app/_shared/lib/hooks/useConnections';

/** Hands the account's connections, read on the server, to the send buttons and the drafts */
export function ConnectionsProvider({ connections, children }: { connections: Connections | null; children: ReactNode }) {
  return <ConnectionsContext.Provider value={connections}>{children}</ConnectionsContext.Provider>;
}
