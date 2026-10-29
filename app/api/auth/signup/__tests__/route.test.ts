// app/api/auth/signup/__tests__/route.test.ts

// Making an account with an email and a password. A bot is refused before Supabase
// is asked, so is an address that isn't invited while sign-ups are closed, and
// Supabase emails the new account a code that confirms the address.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/signup/route';

const auth = vi.hoisted(() => ({ signUp: vi.fn() }));
const bot = vi.hoisted(() => ({ current: false }));
const keep = vi.hoisted(() => ({ keepFreeAudit: vi.fn() }));
vi.mock('botid/server', () => ({ checkBotId: async () => ({ isBot: bot.current }) }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  userDb: async () => ({ auth }),
}));
vi.mock('@/app/_shared/lib/freeAudit/keepFreeAudit', () => keep);

const post = (body: unknown) =>
  POST(
    new NextRequest('https://auditely.app/api/auth/signup', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  );

const NEW = { email: 'new@example.com', password: 'correct horse battery' };
const created = { data: { user: { id: 'user-1', identities: [{ id: 'i-1' }] }, session: null }, error: null };

beforeEach(() => {
  vi.stubEnv('OWNER_EMAIL', 'owner@example.com');
  vi.stubEnv('ALLOWED_EMAILS', 'tester@example.com');
  vi.stubEnv('SIGNUPS_OPEN', 'true');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  bot.current = false;
  auth.signUp.mockReset().mockResolvedValue(created);
  keep.keepFreeAudit.mockReset().mockResolvedValue(false);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/auth/signup', () => {
  it('asks for an email address and a password long enough', async () => {
    for (const body of [{}, { email: 'new', password: NEW.password }, 'not json']) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Enter your email address' });
    }
    const short = await post({ email: NEW.email, password: 'short' });
    expect(short.status).toBe(400);
    // `field` puts the message under the password, not the email
    expect(await short.json()).toEqual({ error: 'Use at least 8 characters.', field: 'password' });
    expect(await (await post({ email: NEW.email, password: 'a'.repeat(73) })).json()).toEqual({ error: 'Use 72 characters or fewer.', field: 'password' });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('refuses a bot before Supabase is asked', async () => {
    bot.current = true;
    const res = await post(NEW);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Couldn't create an account from this browser. Try again in another browser." });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('makes an account only for an invited address while sign-ups are closed', async () => {
    vi.stubEnv('SIGNUPS_OPEN', '');
    const res = await post(NEW);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Auditely is invite-only for now. Use the email you were invited with.' });
    expect(auth.signUp).not.toHaveBeenCalled();

    expect((await post({ email: 'Tester@Example.com', password: NEW.password })).status).toBe(200);
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'tester@example.com' }));
  });

  it("makes the account and has Supabase email its code, with the way back kept on this site", async () => {
    const res = await post({ email: ' New@Example.com ', password: NEW.password, callbackUrl: '/plans' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: NEW.password,
      options: { emailRedirectTo: 'https://auditely.app/auth/callback?next=%2Fplans' },
    });

    await post({ ...NEW, callbackUrl: 'https://evil.example/' });
    expect(auth.signUp.mock.calls[1][0].options.emailRedirectTo).toBe('https://auditely.app/auth/callback?next=%2F');
  });

  // Supabase answers an address that already has an account with a user that has no identities, and sends nothing
  it('says so when the email already has an account', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: 'x', identities: [] }, session: null }, error: null });
    const res = await post(NEW);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'This email already has an account. Sign in instead.' });
  });

  it('signs the account straight in if Supabase needs no confirming, keeping a free audit', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: 'user-1', identities: [{ id: 'i-1' }] }, session: { access_token: 't' } }, error: null });
    expect(await (await post(NEW)).json()).toEqual({ next: '/' });

    keep.keepFreeAudit.mockResolvedValue(true);
    const kept = await POST(
      new NextRequest('https://auditely.app/api/auth/signup', { method: 'POST', body: JSON.stringify(NEW), headers: { cookie: 'auditely_free_audit=fa-1' } })
    );
    expect(await kept.json()).toEqual({ next: '/audit' });
    expect(keep.keepFreeAudit).toHaveBeenLastCalledWith(expect.anything(), 'user-1', 'fa-1');
  });

  it("says what to do when Supabase turns the password or the pace down, or fails", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { status: 422, code: 'weak_password', message: 'weak' } });
    const weak = await post(NEW);
    expect(weak.status).toBe(400);
    expect(await weak.json()).toEqual({ error: 'Choose a stronger password: this one is too easy to guess.', field: 'password' });

    auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { status: 429, code: 'over_email_send_rate_limit', message: 'slow down' } });
    const busy = await post(NEW);
    expect(busy.status).toBe(429);
    expect(await busy.json()).toEqual({ error: 'Too many tries. Wait a few minutes and try again.' });

    auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { status: 500, message: 'smtp down' } });
    const failed = await post(NEW);
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "Couldn't create your account. Try again in a minute." });
    expect(console.error).toHaveBeenCalledWith('[auth] Sign-up failed:', 'smtp down');
  });
});
