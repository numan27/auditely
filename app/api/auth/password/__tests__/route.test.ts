// app/api/auth/password/__tests__/route.test.ts

// Signing in with an email and a password. The same people may sign in as with a
// link, a bot is refused before Supabase is asked, a wrong password says so, and a
// free audit the visitor ran is kept, as the link's callback keeps it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/password/route';

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
const bot = vi.hoisted(() => ({ current: false }));
const keep = vi.hoisted(() => ({ keepFreeAudit: vi.fn() }));
vi.mock('botid/server', () => ({ checkBotId: async () => ({ isBot: bot.current }) }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  userDb: async () => ({ auth }),
}));
vi.mock('@/app/_shared/lib/freeAudit/keepFreeAudit', () => keep);

const post = (body: unknown, cookie?: string) =>
  POST(
    new NextRequest('https://auditely.app/api/auth/password', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: cookie ? { cookie } : undefined,
    })
  );

const OWNER = { email: 'owner@example.com', password: 'correct horse battery' };

beforeEach(() => {
  vi.stubEnv('OWNER_EMAIL', 'Owner@Example.com');
  vi.stubEnv('ALLOWED_EMAILS', '');
  vi.stubEnv('SIGNUPS_OPEN', '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  bot.current = false;
  auth.signInWithPassword.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  keep.keepFreeAudit.mockReset().mockResolvedValue(false);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/auth/password', () => {
  // Its sign-up code was never typed: the form asks for one, and sends a new one
  it("says an account whose email isn't confirmed yet needs its code", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { status: 400, code: 'email_not_confirmed', message: 'Email not confirmed' } });
    const res = await post(OWNER);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Confirm your email first: enter the code we email you.', confirm: true });
  });

  it('asks for the email address and the password', async () => {
    for (const body of [{}, { email: 'owner', password: 'x' }, { email: OWNER.email }, { email: OWNER.email, password: '' }, 'not json']) {
      const res = await post(body);
      expect(res.status).toBe(400);
    }
    expect(await (await post({ password: 'x' })).json()).toEqual({ error: 'Enter your email address' });
    expect(await (await post({ email: OWNER.email })).json()).toEqual({ error: 'Enter your password' });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('refuses a bot before Supabase is asked', async () => {
    bot.current = true;
    const res = await post(OWNER);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Couldn't sign you in from this browser. Email yourself a sign-in link instead." });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('refuses an email that is not invited while sign-ups are closed', async () => {
    const res = await post({ email: 'stranger@example.com', password: 'whatever' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Auditely is invite-only for now. Use the email you were invited with.' });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs the owner in and sends them where they were headed, kept on this site', async () => {
    const res = await post({ email: ' Owner@Example.com ', password: OWNER.password, callbackUrl: '/plans?billing=yearly' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ next: '/plans?billing=yearly' });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'owner@example.com', password: OWNER.password });

    const away = await post({ ...OWNER, callbackUrl: 'https://evil.example/' });
    expect(await away.json()).toEqual({ next: '/' });
  });

  it('lets anyone with an account sign in once sign-ups are open', async () => {
    vi.stubEnv('SIGNUPS_OPEN', 'true');
    const res = await post({ email: 'someone@example.com', password: 'hunter22' });
    expect(res.status).toBe(200);
  });

  it('says so when the email and password do not match', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    const res = await post(OWNER);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "That email and password don't match. Try again, or email yourself a sign-in link.",
    });
  });

  it('asks a user who has made too many tries to wait', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' },
    });
    const res = await post(OWNER);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Too many tries. Wait a few minutes, or email yourself a sign-in link.' });
  });

  it("says it couldn't sign in when Supabase fails", async () => {
    auth.signInWithPassword.mockRejectedValue(new Error('fetch failed'));
    const res = await post(OWNER);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Couldn't sign you in. Try again in a minute." });
  });

  it('keeps the free audit the visitor ran, lands them on it and clears its cookie', async () => {
    keep.keepFreeAudit.mockResolvedValue(true);
    const res = await post(OWNER, 'auditely_free_audit=signed-claim');
    expect(keep.keepFreeAudit).toHaveBeenCalledWith(expect.anything(), 'user-1', 'signed-claim');
    expect(await res.json()).toEqual({ next: '/audit' });
    expect(res.headers.get('set-cookie')).toMatch(/auditely_free_audit=;/);
  });

  it('leaves the cookie alone when the audit was not kept', async () => {
    const res = await post(OWNER, 'auditely_free_audit=signed-claim');
    expect(await res.json()).toEqual({ next: '/' });
    expect(res.headers.get('set-cookie') ?? '').not.toMatch(/auditely_free_audit/);
  });
});
