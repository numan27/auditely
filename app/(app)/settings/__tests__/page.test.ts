// The settings page reads today's free audits for the owner, and never for anyone else.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  freeAuditsSince: vi.fn(),
  growthRows: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  usePathname: () => '/settings',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/_shared/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/app/_shared/lib/freeAudit/freeAuditStore', () => ({ freeAuditsSince: mocks.freeAuditsSince }));
vi.mock('@/app/_shared/lib/growth/growthStore', () => ({ growthRows: mocks.growthRows }));
vi.mock('@/app/_shared/lib/billing/stripe', () => ({ billingReady: () => false }));
vi.mock('@/app/_shared/lib/settings/connections', () => ({
  connectionsFor: async (account: { isOwner: boolean }) => ({
    plan: account.isOwner ? 'owner' : 'free',
    branded: false,
    sender: { name: 'Auditely', signOff: '[Your name]' },
    mailbox: null,
    hubspot: null,
  }),
}));

const { default: SettingsPage } = await import('@/app/(app)/settings/page');

// The profile read: db.from('profiles').select('*').eq('id', …).maybeSingle()
const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {}, error: null }) }) }) }) };
const signedIn = (isOwner: boolean) =>
  mocks.getSession.mockResolvedValue({ db, account: { id: 'u1', email: 'sam@acme.studio', isOwner, subscription: null } });
const open = async () => renderToStaticMarkup(await SettingsPage());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T15:30:00.000Z'));
  vi.stubEnv('FREE_AUDIT_ENABLED', 'true');
  vi.stubEnv('FREE_AUDIT_IP_SALT', 'a'.repeat(32));
  vi.stubEnv('AUTH_SECRET', 'b'.repeat(32));
  vi.stubEnv('GOOGLE_PAGESPEED_API_KEY', 'key');
  vi.stubEnv('FREE_AUDIT_DAILY_CAP', '200');
  mocks.getSession.mockReset();
  mocks.freeAuditsSince.mockReset();
  mocks.growthRows.mockReset();
  mocks.growthRows.mockResolvedValue({
    accounts: [{ id: 'u2', createdAt: '2026-10-27T09:00:00.000Z' }],
    searched: ['u2'], audited: [], paying: [], emailed: [], freeAudits: [],
  });
  mocks.freeAuditsSince.mockResolvedValue([
    { website: 'https://acme.studio/', createdAt: '2026-10-28T13:40:00.000Z', status: 'done', kept: true },
  ]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('SettingsPage', () => {
  it("shows the owner today's free audits, read from midnight UTC", async () => {
    signedIn(true);
    const html = await open();
    expect(mocks.freeAuditsSince).toHaveBeenCalledWith(new Date('2026-10-28T00:00:00.000Z'));
    expect(html).toContain('id="free-audits"');
    expect(html).toContain('1 of 200 free audits used today.');
  });

  it("tells the owner what's missing when free audits can't run", async () => {
    vi.stubEnv('GOOGLE_PAGESPEED_API_KEY', '');
    signedIn(true);
    expect(await open()).toContain('Free audits aren&#x27;t set up: GOOGLE_PAGESPEED_API_KEY.');
  });

  it("shows the owner the last 7 and 30 days' numbers", async () => {
    signedIn(true);
    const html = await open();
    expect(mocks.growthRows).toHaveBeenCalledWith(new Date('2026-10-28T15:30:00.000Z'));
    expect(html).toContain('id="growth"');
    expect(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).toContain('Ran a search 1 (100%) 1 (100%)');
  });

  it("never reads free audits or the numbers for someone who isn't the owner", async () => {
    signedIn(false);
    const html = await open();
    expect(mocks.freeAuditsSince).not.toHaveBeenCalled();
    expect(mocks.growthRows).not.toHaveBeenCalled();
    expect(html).not.toContain('id="free-audits"');
    expect(html).not.toContain('id="growth"');
    expect(html).toContain('Profile and branding');
  });
});
