// app/api/auth/signup/code/__tests__/route.test.ts

// Confirming a new account's email with the code Supabase sent, which signs it in.
// The password chosen with it is set again once the code is right: an account made
// earlier for the same address by someone else, never confirmed, keeps its own
// password through Supabase's sign-up, and mustn't keep it after this.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/signup/code/route';

const auth = vi.hoisted(() => ({ verifyOtp: vi.fn(), updateUser: vi.fn() }));
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
    new NextRequest('https://auditely.app/api/auth/signup/code', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: cookie ? { cookie } : undefined,
    })
  );

const CONFIRM = { email: 'new@example.com', password: 'correct horse battery', code: '482917' };

beforeEach(() => {
  vi.stubEnv('OWNER_EMAIL', 'owner@example.com');
  vi.stubEnv('ALLOWED_EMAILS', '');
  vi.stubEnv('SIGNUPS_OPEN', 'true');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  bot.current = false;
  auth.verifyOtp.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' }, session: { access_token: 't' } }, error: null });
  auth.updateUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  keep.keepFreeAudit.mockReset().mockResolvedValue(false);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/auth/signup/code', () => {
  it('asks for the email, the 6-digit code and the password', async () => {
    expect(await (await post({ ...CONFIRM, email: 'new' })).json()).toEqual({ error: 'Enter your email address' });
    for (const code of ['', '4829', 'abcdef', undefined]) {
      const res = await post({ ...CONFIRM, code });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Enter the 6-digit code from the email.' });
    }
    expect(await (await post({ ...CONFIRM, password: 'short' })).json()).toEqual({ error: 'Use at least 8 characters.' });
    expect(await (await post('not json')).json()).toEqual({ error: 'Enter your email address' });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('refuses a bot, and an address not invited while sign-ups are closed, before Supabase is asked', async () => {
    bot.current = true;
    const botRes = await post(CONFIRM);
    expect(botRes.status).toBe(403);
    expect(await botRes.json()).toEqual({ error: "Couldn't confirm your email from this browser. Try again in another browser." });

    bot.current = false;
    vi.stubEnv('SIGNUPS_OPEN', '');
    const closed = await post(CONFIRM);
    expect(closed.status).toBe(403);
    expect(await closed.json()).toEqual({ error: 'Auditely is invite-only for now. Use the email you were invited with.' });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('confirms the email with the code, sets the chosen password, and sends the account on', async () => {
    const res = await post({ ...CONFIRM, email: ' New@Example.com ', code: ' 482 917 ', callbackUrl: '/plans' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ next: '/plans' });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'new@example.com', token: '482917', type: 'email' });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: CONFIRM.password });
    expect(auth.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(auth.updateUser.mock.invocationCallOrder[0]);

    expect(await (await post({ ...CONFIRM, callbackUrl: 'https://evil.example/' })).json()).toEqual({ next: '/' });
  });

  it('still signs in when the password was already that one, and says nothing; logs any other failure', async () => {
    auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error: { code: 'same_password', message: 'same' } });
    expect((await post(CONFIRM)).status).toBe(200);
    expect(console.error).not.toHaveBeenCalled();

    auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error: { code: 'unexpected', message: 'db down' } });
    expect((await post(CONFIRM)).status).toBe(200);
    expect(console.error).toHaveBeenCalledWith("[auth] Couldn't set the new account's password:", 'db down');
  });

  it('says when the code is wrong or has expired, and when there were too many tries', async () => {
    auth.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' } });
    const wrong = await post(CONFIRM);
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toEqual({ error: 'That code is wrong or has expired. Check it, or send yourself a new one.' });
    expect(auth.updateUser).not.toHaveBeenCalled();

    auth.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { status: 429, code: 'over_request_rate_limit', message: 'slow down' } });
    const busy = await post(CONFIRM);
    expect(busy.status).toBe(429);
    expect(await busy.json()).toEqual({ error: 'Too many tries. Wait a few minutes and try again.' });
  });

  it('keeps a free audit the visitor ran, and lands on it', async () => {
    keep.keepFreeAudit.mockResolvedValue(true);
    const res = await post(CONFIRM, 'auditely_free_audit=fa-1');
    expect(await res.json()).toEqual({ next: '/audit' });
    expect(keep.keepFreeAudit).toHaveBeenCalledWith(expect.anything(), 'user-1', 'fa-1');
    expect(res.headers.get('set-cookie')).toContain('auditely_free_audit=;');
  });
});
