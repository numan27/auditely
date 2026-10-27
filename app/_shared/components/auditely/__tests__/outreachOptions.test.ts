import { describe, it, expect } from 'vitest';
import { outreachOptions } from '@/app/_shared/components/auditely/reportActions/outreachOptions';
import type { Account } from '@/app/_shared/lib/auth/account';
import type { Connections } from '@/app/_shared/lib/hooks/useConnections';

const owner: Account = { id: 'u1', email: 'owner@example.com', isOwner: true };
const tester: Account = { id: 'u2', email: 'sam@acme.studio', isOwner: false };
const pro: Connections = {
  plan: 'pro',
  branded: true,
  sender: { name: 'Acme Studio', signOff: 'Sam Lee, Acme Studio' },
  mailbox: { address: 'sam@acme.studio', source: 'saved' },
  hubspot: { source: 'saved' },
};
const free: Connections = { plan: 'free', branded: false, sender: { name: 'Auditely', signOff: '[Your name]' }, mailbox: null, hubspot: null };
const ownerConnections: Connections = { ...pro, plan: 'owner', mailbox: null, hubspot: null };

describe('outreachOptions', () => {
  it('lets the demo answer every button itself, with no Upwork PDF or address check', () => {
    expect(outreachOptions({ demo: true, account: null, connections: null, upworkPdf: true })).toEqual({
      mail: { kind: 'send' },
      hubspot: { kind: 'send' },
      upworkPdf: false,
      verifyOnOpen: false,
    });
  });

  it('gives the owner today’s buttons, the Upwork PDF where asked for, and the address check', () => {
    expect(outreachOptions({ demo: false, account: owner, connections: ownerConnections, upworkPdf: true })).toEqual({
      mail: { kind: 'send' },
      hubspot: { kind: 'send' },
      upworkPdf: true,
      verifyOnOpen: true,
    });
    expect(outreachOptions({ demo: false, account: owner, connections: null, upworkPdf: false }).upworkPdf).toBe(false);
  });

  it('lets a connected paid account send and use HubSpot, without the owner’s address check', () => {
    expect(outreachOptions({ demo: false, account: tester, connections: pro, upworkPdf: false })).toEqual({
      mail: { kind: 'send' },
      hubspot: { kind: 'send' },
      upworkPdf: false,
      verifyOnOpen: false,
    });
  });

  it('sends a paid account to Settings for whatever is missing', () => {
    expect(outreachOptions({ demo: false, account: tester, connections: { ...pro, branded: false }, upworkPdf: true }).mail).toEqual({
      kind: 'setup',
      label: 'Add your name',
      href: '/settings#profile',
    });
    expect(outreachOptions({ demo: false, account: tester, connections: { ...pro, mailbox: null }, upworkPdf: true }).mail).toEqual({
      kind: 'setup',
      label: 'Connect your mailbox',
      href: '/settings#mailbox',
    });
    expect(outreachOptions({ demo: false, account: tester, connections: { ...pro, hubspot: null }, upworkPdf: true }).hubspot).toEqual({
      kind: 'setup',
      label: 'Connect HubSpot',
      href: '/settings#hubspot',
    });
  });

  it('asks for the name before the mailbox when both are missing', () => {
    expect(
      outreachOptions({ demo: false, account: tester, connections: { ...pro, branded: false, mailbox: null }, upworkPdf: false }).mail
    ).toEqual({ kind: 'setup', label: 'Add your name', href: '/settings#profile' });
  });

  it('gives a Free account drafts to open in its own mail, and HubSpot as an upgrade', () => {
    expect(outreachOptions({ demo: false, account: tester, connections: free, upworkPdf: true })).toEqual({
      mail: { kind: 'compose' },
      hubspot: { kind: 'upgrade' },
      upworkPdf: false,
      verifyOnOpen: false,
    });
  });

  it('treats an account whose connections didn’t load like a Free one', () => {
    expect(outreachOptions({ demo: false, account: tester, connections: null, upworkPdf: true })).toEqual({
      mail: { kind: 'compose' },
      hubspot: { kind: 'upgrade' },
      upworkPdf: false,
      verifyOnOpen: false,
    });
  });

  it('never offers the Upwork PDF to anyone but the owner', () => {
    expect(outreachOptions({ demo: false, account: tester, connections: pro, upworkPdf: true }).upworkPdf).toBe(false);
    expect(outreachOptions({ demo: false, account: null, connections: null, upworkPdf: true }).upworkPdf).toBe(false);
  });
});
