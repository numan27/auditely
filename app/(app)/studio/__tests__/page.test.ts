// The Brand studio page: a plan without branding sees a sample look with every
// field disabled and what would unlock it; a paid account edits its own brand;
// before the migration the owner is told which one to run.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  usePathname: () => '/studio',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/_shared/lib/supabase/server', () => ({ getSession: mocks.getSession }));
// The page reads as the user: the service client stays unused
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));

const { default: StudioPage } = await import('@/app/(app)/studio/page');

const ROW = {
  display_name: 'Sam Lee',
  company: 'Acme Studio',
  website: 'https://acme.studio/',
  logo_data_url: null,
  contact_email: null,
  contact_phone: null,
  booking_url: null,
  brand_design: { accent: '#0e7490' },
};
type Read = { data: Record<string, unknown> | null; error: { message: string } | null };
// The profile read: db.from('profiles').select('*').eq('id', …).maybeSingle()
const signedIn = (plan: 'free' | 'pro' | 'owner', read: Read = { data: ROW, error: null }) =>
  mocks.getSession.mockResolvedValue({
    db: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => read }) }) }) },
    account: {
      id: 'u1',
      email: 'sam@acme.studio',
      isOwner: plan === 'owner',
      subscription: plan === 'pro' ? { plan: 'pro', interval: 'month', status: 'active' } : null,
    },
  });
const open = async () => renderToStaticMarkup(await StudioPage());

beforeEach(() => {
  mocks.getSession.mockReset();
  vi.stubEnv('NEXT_PUBLIC_BETA_MODE', 'false');
});
afterEach(() => vi.unstubAllEnvs());

describe('StudioPage', () => {
  it('sends a visitor without a session to the login', async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(StudioPage()).rejects.toThrow('NEXT_REDIRECT /login');
  });

  it('shows a Free account the sample look with every field disabled, and the plans that unlock it', async () => {
    signedIn('free');
    const html = await open();
    expect(html).toContain('<fieldset disabled=""');
    expect(html).toContain('Brand studio comes with Pro and Agency');
    expect(html).toContain('href="/plans"');
    expect(html).not.toContain('Save changes');
  });

  it('sends nobody to the plans while checkout is closed in the beta', async () => {
    vi.stubEnv('NEXT_PUBLIC_BETA_MODE', 'true');
    signedIn('free');
    const html = await open();
    expect(html).toContain('Paid plans open after the beta.');
    expect(html).not.toContain('href="/plans"');
  });

  it('signs the sample look with a made-up studio when the account has no name', async () => {
    signedIn('free', { data: { ...ROW, display_name: null, company: null }, error: null });
    expect(await open()).toContain('value="Brightside Web Co."');
  });

  it('lets a paid account edit its own brand', async () => {
    signedIn('pro');
    const html = await open();
    expect(html).not.toContain('<fieldset disabled');
    expect(html).not.toContain('comes with Pro and Agency');
    expect(html).toContain('value="Acme Studio"');
    expect(html).toContain('Save changes');
  });

  it('fills the Brand tab from the saved profile, with the saved logo and a way to remove it', async () => {
    const logo = 'data:image/png;base64,iVBORw0KGgo=';
    signedIn('pro', { data: { ...ROW, contact_phone: '+1 555 0100', logo_data_url: logo }, error: null });
    const html = await open();
    expect(html).toContain('value="Sam Lee"');
    expect(html).toContain('value="+1 555 0100"');
    expect(html).toContain('Leave blank to use sam@acme.studio.');
    expect(html).toContain(`src="${logo}"`);
    expect(html).toContain('Remove');
  });

  it('tells the owner which migration to run before the design can be saved, and anyone else to try later', async () => {
    const before: Record<string, unknown> = { ...ROW };
    delete before.brand_design;
    signedIn('owner', { data: before, error: null });
    expect(await open()).toContain('docs/migrations/2026-11-02-brand-studio.sql');
    signedIn('pro', { data: before, error: null });
    expect(await open()).toContain('Your brand can&#x27;t be saved right now.');
  });

  it('offers nothing to save when the profile couldn’t be read', async () => {
    signedIn('pro', { data: null, error: { message: 'timeout' } });
    const html = await open();
    expect(html).toContain('Couldn&#x27;t load your brand.');
    expect(html).not.toContain('Save changes');
  });
});
