import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fakes: the SSR client answers getClaims, the cookie store is empty, and the
// service client's profiles lookup records its filter.
const fake = vi.hoisted(() => ({
  claims: null as { sub?: string; email?: string } | null,
  profiles: null as { id: string } | null,
  profileFilter: null as [string, string] | null,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getClaims: async () => ({ data: fake.claims ? { claims: fake.claims } : null, error: null }) },
  }),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({
  serviceDb: {
    from: () => ({
      select: () => ({
        eq: (column: string, value: string) => {
          fake.profileFilter = [column, value];
          return { maybeSingle: async () => ({ data: fake.profiles, error: null }) };
        },
      }),
    }),
  },
}));

import { getSession, ownerUserId, unauthorized, ownerOnly } from '@/app/_shared/lib/supabase/server';

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
  vi.stubEnv('OWNER_EMAIL', 'Owner@Example.com');
  vi.stubEnv('ALLOWED_EMAILS', '');
  vi.stubEnv('SIGNUPS_OPEN', '');
  fake.claims = null;
  fake.profiles = null;
  fake.profileFilter = null;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getSession', () => {
  it('maps the claims to an account, owner by email', async () => {
    fake.claims = { sub: 'u1', email: 'Owner@Example.com' };
    expect((await getSession())?.account).toEqual({ id: 'u1', email: 'owner@example.com', isOwner: true });
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

  it('is null when there is no such account or no OWNER_EMAIL', async () => {
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
