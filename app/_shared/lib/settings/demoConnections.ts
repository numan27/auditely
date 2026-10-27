// app/_shared/lib/settings/demoConnections.ts

// What the demo shows as connected: the owner's brand, with nothing to send
// through. A plain module rather than part of the 'use client' hook, so the demo's
// server page can hand it to the provider.

import type { Connections } from '@/app/_shared/lib/hooks/useConnections';

export const DEMO_CONNECTIONS: Connections = {
  plan: 'owner',
  branded: true,
  sender: { name: 'DevArtVentures', signOff: 'The DevArtVentures team' },
  mailbox: null,
  hubspot: null,
};
