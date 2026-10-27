import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The user_secrets table, read by the real savedConnections
const secrets = vi.hoisted(() => ({
  result: { data: [] as { kind: string; label: string | null }[] | null, error: null as { code: string; message: string } | null },
}));
vi.mock('@/app/_shared/lib/supabase/client', () => ({
  serviceDb: { from: () => ({ select: () => ({ eq: async () => secrets.result }) }) },
}));
vi.mock('@/app/_shared/lib/brand/brand', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/brand/brand')>()),
  brandFor: vi.fn(),
}));
vi.mock('@/app/_shared/lib/email/mailer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/email/mailer')>()),
  emailSetupProblem: vi.fn(),
}));

const { connectionsFor } = await import('@/app/_shared/lib/settings/connections');
const { BrandUnavailable, brandFor } = await import('@/app/_shared/lib/brand/brand');
const { emailSetupProblem } = await import('@/app/_shared/lib/email/mailer');
const { resolveBrand } = await import('@/app/_shared/lib/brand/brandRules');

const OWNER = { id: 'owner-1', email: 'owner@example.com', isOwner: true };
const tester = { id: 'u2', email: 'sam@acme.studio', isOwner: false };
const ACME_PROFILE = {
  email: 'sam@acme.studio',
  display_name: 'Sam Lee',
  company: 'Acme Studio',
  website: null,
  logo_data_url: null,
  contact_email: null,
  contact_phone: null,
  booking_url: null,
};
const ACME = resolveBrand({ profile: ACME_PROFILE, isOwner: false, plan: 'pro' });
const OWNER_CONTACT = { name: 'Numan', phone: null, email: 'hello@devartventures.com', bookingUrl: null };

const saved = (rows: { kind: string; label: string | null }[]) => {
  secrets.result = { data: rows, error: null };
};

beforeEach(() => {
  saved([]);
  vi.mocked(brandFor).mockReset().mockResolvedValue(ACME);
  vi.mocked(emailSetupProblem).mockReset().mockReturnValue(null);
  vi.stubEnv('PLAN_OVERRIDES', 'sam@acme.studio:pro');
  vi.stubEnv('FROM_EMAIL', 'DevArtVentures <hello@devartventures.com>');
  vi.stubEnv('HUBSPOT_TOKEN', 'env-token');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('connectionsFor', () => {
  it('tells the browser what is connected, never a password or token', async () => {
    saved([
      { kind: 'smtp', label: 'sam@acme.studio' },
      { kind: 'hubspot', label: null },
    ]);
    const c = await connectionsFor(tester);
    expect(c).toEqual({
      plan: 'pro',
      branded: true,
      sender: { name: 'Acme Studio', signOff: 'Sam Lee, Acme Studio' },
      mailbox: { address: 'sam@acme.studio', source: 'saved' },
      hubspot: { source: 'saved' },
    });
    expect(brandFor).toHaveBeenCalledWith('u2');
  });

  it('shows the owner’s Vercel mailbox and HubSpot when nothing is saved', async () => {
    vi.mocked(brandFor).mockResolvedValue(resolveBrand({ profile: null, isOwner: true, plan: 'owner' }, OWNER_CONTACT));
    expect(await connectionsFor(OWNER)).toEqual({
      plan: 'owner',
      branded: true,
      sender: { name: 'DevArtVentures', signOff: 'Numan, DevArtVentures' },
      mailbox: { address: 'hello@devartventures.com', source: 'env' },
      hubspot: { source: 'env' },
    });
  });

  it('shows the owner’s saved mailbox and HubSpot over the Vercel ones', async () => {
    saved([
      { kind: 'smtp', label: 'numan@devartventures.com' },
      { kind: 'hubspot', label: null },
    ]);
    const c = await connectionsFor(OWNER);
    expect(c.mailbox).toEqual({ address: 'numan@devartventures.com', source: 'saved' });
    expect(c.hubspot).toEqual({ source: 'saved' });
  });

  it('shows the owner nothing connected when Vercel has no mailbox or HubSpot token', async () => {
    vi.mocked(emailSetupProblem).mockReturnValue('Email sending isn’t set up.');
    vi.stubEnv('HUBSPOT_TOKEN', '');
    const c = await connectionsFor(OWNER);
    expect(c.mailbox).toBeNull();
    expect(c.hubspot).toBeNull();
  });

  it('never lends the owner’s Vercel mailbox or HubSpot to anyone else', async () => {
    const c = await connectionsFor(tester);
    expect(c.mailbox).toBeNull();
    expect(c.hubspot).toBeNull();
  });

  it('reads a missing secrets table as nothing saved', async () => {
    secrets.result = { data: null, error: { code: '42P01', message: 'relation "user_secrets" does not exist' } };
    const c = await connectionsFor(tester);
    expect(c.mailbox).toBeNull();
    expect(c.hubspot).toBeNull();
    expect((await connectionsFor(OWNER)).mailbox).toEqual({ address: 'hello@devartventures.com', source: 'env' });
  });

  it('reads a secrets table it can’t reach as nothing saved, so the app still opens', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    secrets.result = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } };
    const c = await connectionsFor(tester);
    expect(c.mailbox).toBeNull();
    expect(log).toHaveBeenCalled();
  });

  it('reads a profile that can’t be loaded as unbranded, and as DevArtVentures for the owner', async () => {
    vi.mocked(brandFor).mockRejectedValue(new BrandUnavailable('timeout'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = await connectionsFor(tester);
    expect(c.branded).toBe(false);
    expect(c.sender).toEqual({ name: 'Auditely', signOff: '[Your name]' });
    const owner = await connectionsFor(OWNER);
    expect(owner.branded).toBe(true);
    expect(owner.sender.name).toBe('DevArtVentures');
  });

  it('reads a Free account with a profile as unbranded', async () => {
    vi.stubEnv('PLAN_OVERRIDES', '');
    vi.mocked(brandFor).mockResolvedValue(resolveBrand({ profile: ACME_PROFILE, isOwner: false, plan: 'free' }));
    const c = await connectionsFor(tester);
    expect(c.plan).toBe('free');
    expect(c.branded).toBe(false);
  });
});
