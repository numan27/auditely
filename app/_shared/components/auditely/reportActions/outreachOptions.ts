// app/_shared/components/auditely/reportActions/outreachOptions.ts

// What a report card offers for emailing the lead and handing it to HubSpot,
// by who is looking: the demo answers every button itself, the owner keeps
// today's, a paid account sends from what it connected in Settings, and a Free
// account opens drafts in its own mail (its Send email only says it's a paid feature).

import type { Account } from '@/app/_shared/lib/auth/account';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import type { Connections } from '@/app/_shared/lib/hooks/useConnections';
import { planHas } from '@/app/_shared/lib/usage/plans';

export type OutreachAction = { kind: 'send' } | { kind: 'compose' } | { kind: 'upgrade' } | { kind: 'setup'; label: string; href: string };

export interface OutreachOptions {
  mail: OutreachAction;
  hubspot: OutreachAction;
  /** The report without contact details or links, to attach on Upwork */
  upworkPdf: boolean;
  /** Checks the address when the email opens (Verifalia, the owner's) */
  verifyOnOpen: boolean;
}

const SEND: OutreachAction = { kind: 'send' };

const setup = (label: string, section: string): OutreachAction => ({ kind: 'setup', label, href: `${ROUTES.SETTINGS}#${section}` });

export function outreachOptions({
  demo,
  account,
  connections,
  upworkPdf,
}: {
  demo: boolean;
  account: Account | null;
  connections: Connections | null;
  /** Whether the card asks for the Upwork PDF (Audit a website) */
  upworkPdf: boolean;
}): OutreachOptions {
  if (demo) return { mail: SEND, hubspot: SEND, upworkPdf: false, verifyOnOpen: false };
  if (account?.isOwner) return { mail: SEND, hubspot: SEND, upworkPdf, verifyOnOpen: true };
  if (connections && planHas(connections.plan, 'mailbox')) {
    // An email signed "[Your name]" can't go out from a real mailbox
    const mail = !connections.branded
      ? setup('Add your name', 'profile')
      : !connections.mailbox
        ? setup('Connect your mailbox', 'mailbox')
        : SEND;
    return { mail, hubspot: connections.hubspot ? SEND : setup('Connect HubSpot', 'hubspot'), upworkPdf: false, verifyOnOpen: false };
  }
  return { mail: { kind: 'compose' }, hubspot: { kind: 'upgrade' }, upworkPdf: false, verifyOnOpen: false };
}
