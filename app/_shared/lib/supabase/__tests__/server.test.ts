import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fakes: the SSR client answers getClaims and records its options, the cookie
// store is empty, and the service client's profiles lookup records its filter.
const fake = vi.hoisted(() => ({
  clientOptions: null as { cookieOptions?: Record<string, unknown> } | null,
  claims: null as { sub?: string; email?: string } | null,
  profiles: null as { id: string } | null,
  profilesError: null as { message: string } | null,
  profileFilter: null as [string, string] | null,
  subscription: null as Record<string, unknown> | null,
  subscriptionError: null as { message: string } | null,
  subscriptionFilter: null as [string, string] | null,
  joined: null as Record<string, unknown> | null,
  joinedError: null as { message: string } | null,
  joinedAsked: null as [string, string, string] | null,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: { cookieOptions?: Record<string, unknown> }) => {
    fake.clientOptions = options;
    return {
      auth: { getClaims: async () => ({ data: fake.claims ? { claims: fake.claims } : null, error: null }) },
      // The account's own subscriptions and profiles rows, read as the user
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: string) => {
            if (table === 'profiles') {
              fake.joinedAsked = [columns, column, value];
              return { maybeSingle: async () => ({ data: fake.joined, error: fake.joinedError }) };
            }
            fake.subscriptionFilter = [column, value];
            return { maybeSingle: async () => ({ data: fake.subscription, error: fake.subscriptionError }) };
          },
        }),
      }),
    };
  },
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({
  serviceDb: {
    from: () => ({
      select: () => ({
        eq: (column: string, value: string) => {
          fake.profileFilter = [column, value];
          return { maybeSingle: async () => ({ data: fake.profiles, error: fake.profilesError }) };
        },
      }),
    }),
  },
}));

import { getSession, ownerUserId, unauthorized, ownerOnly, userDb } from '@/app/_shared/lib/supabase/server';

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
  vi.stubEnv('OWNER_EMAIL', 'Owner@Example.com');
  vi.stubEnv('ALLOWED_EMAILS', '');
  vi.stubEnv('SIGNUPS_OPEN', '');
  fake.clientOptions = null;
  fake.claims = null;
  fake.profiles = null;
  fake.profilesError = null;
  fake.profileFilter = null;
  fake.subscription = null;
  fake.subscriptionError = null;
  fake.subscriptionFilter = null;
  fake.joined = null;
  fake.joinedError = null;
  fake.joinedAsked = null;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('userDb', () => {
  it('writes the session cookies HttpOnly, so no script can read the refresh token', async () => {
    await userDb();
    expect(fake.clientOptions?.cookieOptions).toMatchObject({ httpOnly: true, secure: false });
  });
});

describe('getSession', () => {
  it('maps the claims to an account, owner by email', async () => {
    fake.claims = { sub: 'u1', email: 'Owner@Example.com' };
    expect((await getSession())?.account).toEqual({ id: 'u1', email: 'owner@example.com', isOwner: true, subscription: null, joinedAt: null });
  });

  it('puts the day the account was made on it, which a Free allowance counts 30 days from', async () => {
    fake.claims = { sub: 'u2', email: 'tester@x.com' };
    vi.stubEnv('ALLOWED_EMAILS', 'tester@x.com');
    fake.joined = { created_at: '2026-10-27T15:00:00+00:00' };
    expect((await getSession())?.account.joinedAt).toBe('2026-10-27T15:00:00+00:00');
    expect(fake.joinedAsked).toEqual(['created_at', 'id', 'u2']);
  });

  it('signs in without a sign-up date when the profile cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fake.claims = { sub: 'u2', email: 'tester@x.com' };
    vi.stubEnv('ALLOWED_EMAILS', 'tester@x.com');
    fake.joinedError = { message: 'timeout' };
    const session = await getSession();
    expect(session?.account.id).toBe('u2');
    expect(session?.account.joinedAt).toBeNull();
  });

  it("puts the account's live subscription on it, read as the user", async () => {
    fake.claims = { sub: 'u2', email: 'tester@x.com' };
    vi.stubEnv('ALLOWED_EMAILS', 'tester@x.com');
    fake.subscription = {
      plan: 'pro', billing_interval: 'year', status: 'active', period_anchor: '2026-03-14T09:30:00.000Z',
      current_period_end: '2999-03-14T09:30:00.000Z', ends_at: null,
    };
    expect((await getSession())?.account.subscription).toMatchObject({ plan: 'pro', interval: 'year' });
    expect(fake.subscriptionFilter).toEqual(['user_id', 'u2']);
  });

  it('signs in with no subscription when the table cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fake.claims = { sub: 'u2', email: 'tester@x.com' };
    vi.stubEnv('ALLOWED_EMAILS', 'tester@x.com');
    fake.subscriptionError = { message: 'missing' };
    const session = await getSession();
    expect(session?.account.id).toBe('u2');
    expect(session?.account.subscription).toBeNull();
  });

  it('has no session without claims, or for an email that may not sign in', async () => {
    fake.claims = null;
    expect(await getSession()).toBeNull();
    fake.claims = { sub: 'u2', email: 'stranger@z.com' };
    expect(await getSession()).toBeNull();
  });

  it('has no session when the claims carry no email', async () => {
    fake.claims = { sub: 'u3' };
    expect(await getSession()).toBeNull();
  });
});

describe('ownerUserId', () => {
  it('finds the owner account by OWNER_EMAIL', async () => {
    fake.profiles = { id: 'owner-1' };
    expect(await ownerUserId()).toBe('owner-1');
    expect(fake.profileFilter).toEqual(['email', 'owner@example.com']);
  });

  it('logs a failed lookup with the migration to run, and returns null', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    fake.profilesError = { message: 'relation "profiles" does not exist' };
    expect(await ownerUserId()).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('2026-10-28-accounts.sql'));
    error.mockRestore();
  });

  it('is null when there is no such account or no OWNER_EMAIL', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await ownerUserId()).toBeNull();
    vi.stubEnv('OWNER_EMAIL', '');
    expect(await ownerUserId()).toBeNull();
  });
});

describe('error responses', () => {
  it('answers 401 and 403 with a next step', async () => {
    const no = unauthorized();
    expect(no.status).toBe(401);
    expect(await no.json()).toEqual({ error: 'Sign in to continue' });
    const forbidden = ownerOnly();
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: "This isn't available on your account yet." });
  });
});
