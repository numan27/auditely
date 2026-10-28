// app/_shared/lib/settings/demoConnections.ts

// What the demo shows as connected: every feature, signed with placeholders for
// the visitor's own name and agency, with nothing to send through. A plain module
// rather than part of the 'use client' hook, so the demo's server page can hand it
// to the provider.

import type { Connections } from '@/app/_shared/lib/hooks/useConnections';
import { DEMO_SIGN_OFF } from '@/app/_shared/lib/demo/unbrand';

export const DEMO_CONNECTIONS: Connections = {
  plan: 'owner',
  branded: true,
  sender: { name: '[Your agency]', signOff: DEMO_SIGN_OFF },
  mailbox: null,
  hubspot: null,
};
