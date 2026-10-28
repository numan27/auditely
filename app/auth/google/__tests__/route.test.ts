// app/auth/google/__tests__/route.test.ts

// Starting Google sign-in: Supabase gives the Google consent URL, and Google sends
// the user back to /auth/callback on this site with where they were going.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/auth/google/route';

// Fake Supabase Auth, as userDb() hands it to the route
const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  getClaims: vi.fn(),
  signOut: vi.fn(),
}));
const google = vi.hoisted(() => ({ on: true }));
vi.mock('@/app/_shared/lib/auth/googleSignIn', () => ({ googleSignInOn: async () => google.on }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  userDb: async () => ({ auth }),
}));

const GOOGLE = 'https://project.supabase.co/auth/v1/authorize?provider=google';
const start = (query = '') => GET(new NextRequest(`https://auditely.app/auth/google${query}`));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.values(auth).forEach((fn) => fn.mockReset());
  google.on = true;
  auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: GOOGLE }, error: null });
});
afterEach(() => vi.restoreAllMocks());

describe('GET /auth/google', () => {
  it('sends the user to Google, to come back to the callback with where they were going', async () => {
    const res = await start('?next=%2Fsearch%2Fabc');
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://auditely.app/auth/callback?next=%2Fsearch%2Fabc' },
    });
    expect(res.headers.get('location')).toBe(GOOGLE);
  });

  it('never lets the return address leave the site', async () => {
    for (const next of ['%2F%2Fevil.com', 'https%3A%2F%2Fevil.com', '']) {
      auth.signInWithOAuth.mockClear();
      await start(`?next=${next}`);
      expect(auth.signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe('https://auditely.app/auth/callback?next=%2F');
    }
  });

  it("sends the user back to the login, not to Supabase's error page, while Google isn't turned on", async () => {
    google.on = false;
    const res = await start('?next=%2Fplans');
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(new URL(res.headers.get('location')!).href).toBe('https://auditely.app/login?error=google-off');
  });

  it('sends the user back to the login when Google sign-in cannot start', async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: null }, error: { message: 'provider is not enabled' } });
    const res = await start('?next=%2F');
    expect(new URL(res.headers.get('location')!).href).toBe('https://auditely.app/login?error=google');
  });
});
