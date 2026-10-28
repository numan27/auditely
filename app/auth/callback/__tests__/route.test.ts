// app/auth/callback/__tests__/route.test.ts

// Finishing a sign-in. Google and a link opened in the same browser bring a code;
// a link opened anywhere else (another browser, a phone) brings a token hash. The
// session is checked against the sign-in rules before the user goes anywhere, and
// where they go never leaves the site.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/auth/callback/route';

// Fake Supabase Auth, as userDb() hands it to the route
const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  getClaims: vi.fn(),
  signOut: vi.fn(),
}));
const fakeDb = vi.hoisted(() => ({}));
const keep = vi.hoisted(() => vi.fn());
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  userDb: async () => Object.assign(fakeDb, { auth }),
}));
vi.mock('@/app/_shared/lib/freeAudit/keepFreeAudit', () => ({ keepFreeAudit: keep }));

const open = (query: string, cookie?: string) =>
  GET(new NextRequest(`https://auditely.app/auth/callback?${query}`, cookie ? { headers: { cookie } } : undefined));

// Where the redirect leads: path and query on this site, or the whole URL off it
const sentTo = (res: Response) => {
  const url = new URL(res.headers.get('location')!);
  return url.origin === 'https://auditely.app' ? `${url.pathname}${url.search}` : url.href;
};

const signedInAs = (email: string) => auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'u1', email } }, error: null });

beforeEach(() => {
  vi.stubEnv('OWNER_EMAIL', 'Owner@Example.com');
  vi.stubEnv('ALLOWED_EMAILS', 'tester@example.com');
  vi.stubEnv('SIGNUPS_OPEN', '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.values(auth).forEach((fn) => fn.mockReset());
  auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
  auth.signOut.mockResolvedValue({ error: null });
  signedInAs('owner@example.com');
  keep.mockReset();
  keep.mockResolvedValue(false);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /auth/callback', () => {
  it('trades a code for a session and returns to where the user was', async () => {
    const res = await open('code=c1&next=%2Fsearch%2Fabc');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('c1');
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(sentTo(res)).toBe('/search/abc');
  });

  // The emailed link, opened without the browser that asked for it
  it('verifies a token hash from the link, wherever it is opened', async () => {
    const res = await open('next=%2Fsearches&token_hash=h1&type=email');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'h1', type: 'email' });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(sentTo(res)).toBe('/searches');
  });

  it('keeps the return address on the site', async () => {
    expect(sentTo(await open('code=c1&next=https%3A%2F%2Fevil.com'))).toBe('/');
    expect(sentTo(await open('code=c1&next=%2F%2Fevil.com'))).toBe('/');
    expect(sentTo(await open('token_hash=h1&type=email&next=%2F%09%2Fevil.com'))).toBe('/');
    expect(sentTo(await open('code=c1'))).toBe('/');
  });

  it('lets an invited tester in, whatever the case of the address', async () => {
    signedInAs('Tester@Example.com');
    expect(sentTo(await open('code=c1&next=%2Fsearches'))).toBe('/searches');
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  // Supabase made the account; the rules still say no, so the session is dropped
  it('signs a stranger straight back out', async () => {
    signedInAs('stranger@example.com');
    const res = await open('code=c1&next=%2Fsearches');
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(sentTo(res)).toBe('/login?error=closed');
  });

  it('sends an expired or used link back to the login', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: 'invalid flow state', status: 400 } });
    expect(sentTo(await open('code=c1&next=%2Fsearches'))).toBe('/login?error=link');

    auth.verifyOtp.mockResolvedValue({ data: {}, error: { message: 'Token has expired or is invalid', status: 403 } });
    expect(sentTo(await open('token_hash=h1&type=email'))).toBe('/login?error=link');
  });

  it('sends a link with nothing to sign in with back to the login', async () => {
    expect(sentTo(await open('next=%2Fsearches'))).toBe('/login?error=link');
    expect(sentTo(await open('token_hash=h1&type=recovery'))).toBe('/login?error=link');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('sends the user back to the login when the session cannot be read', async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: { message: 'bad jwt' } });
    expect(sentTo(await open('code=c1'))).toBe('/login?error=link');

    auth.getClaims.mockRejectedValue(new Error('network'));
    expect(sentTo(await open('code=c1'))).toBe('/login?error=link');
  });

  // The landing page's free audit, signed in the visitor's cookie
  it('keeps the free audit from the cookie and opens the audit view', async () => {
    keep.mockResolvedValue(true);
    const res = await open('code=c1&next=%2F', 'auditely_free_audit=f1.sig');
    expect(keep).toHaveBeenCalledWith(fakeDb, 'u1', 'f1.sig');
    expect(sentTo(res)).toBe('/audit');
  });

  it('clears the free-audit cookie once the audit is kept, and keeps it when it was not', async () => {
    keep.mockResolvedValue(true);
    const kept = await open('code=c1&next=%2F', 'auditely_free_audit=f1.sig');
    expect(kept.headers.get('set-cookie')).toMatch(/auditely_free_audit=;[^,]*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
    keep.mockResolvedValue(false);
    const notKept = await open('code=c1&next=%2F', 'auditely_free_audit=f1.sig');
    expect(notKept.headers.get('set-cookie') ?? '').not.toContain('auditely_free_audit');
  });

  it("keeps it from the link's keep= when the link opens in another browser", async () => {
    keep.mockResolvedValue(true);
    const res = await open('next=%2F&keep=f1.sig&token_hash=h1&type=email');
    expect(keep).toHaveBeenCalledWith(fakeDb, 'u1', 'f1.sig');
    expect(sentTo(res)).toBe('/audit');
  });

  it('still goes where the user was headed when they were headed somewhere', async () => {
    keep.mockResolvedValue(true);
    expect(sentTo(await open('code=c1&next=%2Fplans', 'auditely_free_audit=f1.sig'))).toBe('/plans');
  });

  it('signs in as before when there is nothing to keep', async () => {
    expect(sentTo(await open('code=c1'))).toBe('/');
    expect(keep).not.toHaveBeenCalled();
    expect(sentTo(await open('code=c1&next=%2F', 'auditely_free_audit=forged'))).toBe('/');
  });

  it('keeps nothing for someone who may not sign in', async () => {
    signedInAs('stranger@example.com');
    expect(sentTo(await open('code=c1&keep=f1.sig'))).toBe('/login?error=closed');
    expect(keep).not.toHaveBeenCalled();
  });
});
