// app/api/auth/__tests__/route.test.ts

// Sending a sign-in link and signing out. Only the owner and the allowlist get a
// link (a stranger is refused before Supabase is asked), the link comes back to
// /auth/callback on the same site, and the place to return to never leaves it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, POST } from '@/app/api/auth/route';

// Fake Supabase Auth, as userDb() hands it to the route
const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  getClaims: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  userDb: async () => ({ auth }),
}));

const post = (body: unknown, cookie?: string) =>
  POST(
    new NextRequest('https://auditely.app/api/auth', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: cookie ? { cookie } : undefined,
    })
  );

// The emailRedirectTo the link was sent with
const redirectTo = () => new URL(auth.signInWithOtp.mock.calls[0][0].options.emailRedirectTo);

beforeEach(() => {
  vi.stubEnv('OWNER_EMAIL', 'Owner@Example.com');
  vi.stubEnv('ALLOWED_EMAILS', 'tester@example.com');
  vi.stubEnv('SIGNUPS_OPEN', '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.values(auth).forEach((fn) => fn.mockReset());
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  auth.signOut.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/auth', () => {
  it('asks for an email address when there is none, or it is not one', async () => {
    for (const body of [{}, { email: '' }, { email: 'owner' }, { email: 42 }, 'not json']) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Enter your email address' });
    }
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('refuses an email that is not invited, without asking Supabase', async () => {
    const res = await post({ email: 'stranger@example.com' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Auditely is invite-only for now. Use the email you were invited with.' });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('emails the owner a link back to the callback, with where to return', async () => {
    const res = await post({ email: ' Owner@Example.com ', callbackUrl: '/search/abc?x=1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: 'https://auditely.app/auth/callback?next=%2Fsearch%2Fabc%3Fx%3D1',
      },
    });
    expect(redirectTo().searchParams.get('next')).toBe('/search/abc?x=1');
  });

  it('emails an invited tester a link back to the home page by default', async () => {
    expect((await post({ email: 'tester@example.com' })).status).toBe(200);
    expect(redirectTo().href).toBe('https://auditely.app/auth/callback?next=%2F');
  });

  it('never lets the return address leave the site', async () => {
    for (const callbackUrl of ['//evil.com', 'https://evil.com', '/\t/evil.com']) {
      auth.signInWithOtp.mockClear();
      expect((await post({ email: 'owner@example.com', callbackUrl })).status).toBe(200);
      const url = redirectTo();
      expect(url.origin).toBe('https://auditely.app');
      expect(url.pathname).toBe('/auth/callback');
      expect(url.search).toBe('?next=%2F');
    }
  });

  it('says the link was not sent when Supabase fails', async () => {
    auth.signInWithOtp.mockResolvedValue({ data: {}, error: { message: 'rate limited', status: 429 } });
    const res = await post({ email: 'owner@example.com' });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Couldn't send the link. Try again in a minute." });
  });

  it('puts the free audit in the sign-in link so it can be kept from any browser', async () => {
    await post({ email: 'owner@example.com', callbackUrl: '/plans' }, 'auditely_free_audit=f1.sig%2B/');
    const url = redirectTo();
    expect(url.searchParams.get('next')).toBe('/plans');
    expect(url.searchParams.get('keep')).toBe('f1.sig+/');
  });
});

describe('DELETE /api/auth', () => {
  it('signs out', async () => {
    const res = await DELETE();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});
