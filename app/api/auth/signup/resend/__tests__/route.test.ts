// app/api/auth/signup/resend/__tests__/route.test.ts

// A new code for an account whose email isn't confirmed yet: the first one expired,
// went astray, or the tab was closed before it was typed.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/signup/resend/route';

const auth = vi.hoisted(() => ({ resend: vi.fn() }));
const bot = vi.hoisted(() => ({ current: false }));
vi.mock('botid/server', () => ({ checkBotId: async () => ({ isBot: bot.current }) }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  userDb: async () => ({ auth }),
}));

const post = (body: unknown) =>
  POST(new NextRequest('https://auditely.app/api/auth/signup/resend', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.stubEnv('OWNER_EMAIL', 'owner@example.com');
  vi.stubEnv('ALLOWED_EMAILS', '');
  vi.stubEnv('SIGNUPS_OPEN', 'true');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  bot.current = false;
  auth.resend.mockReset().mockResolvedValue({ data: {}, error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/auth/signup/resend', () => {
  it('asks for an email address', async () => {
    for (const body of [{}, { email: 'new' }, 'not json']) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Enter your email address' });
    }
    expect(auth.resend).not.toHaveBeenCalled();
  });

  it('refuses a bot, and an address not invited while sign-ups are closed', async () => {
    bot.current = true;
    expect((await post({ email: 'new@example.com' })).status).toBe(403);
    bot.current = false;
    vi.stubEnv('SIGNUPS_OPEN', '');
    const closed = await post({ email: 'new@example.com' });
    expect(closed.status).toBe(403);
    expect(await closed.json()).toEqual({ error: 'Auditely is invite-only for now. Use the email you were invited with.' });
    expect(auth.resend).not.toHaveBeenCalled();
  });

  it('has Supabase email a new code, with the way back kept on this site', async () => {
    const res = await post({ email: ' New@Example.com ', callbackUrl: '/plans' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true });
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'new@example.com',
      options: { emailRedirectTo: 'https://auditely.app/auth/callback?next=%2Fplans' },
    });
  });

  it('asks for a minute between codes, and says when sending failed', async () => {
    auth.resend.mockResolvedValueOnce({ data: {}, error: { status: 429, code: 'over_email_send_rate_limit', message: 'wait 60s' } });
    const busy = await post({ email: 'new@example.com' });
    expect(busy.status).toBe(429);
    expect(await busy.json()).toEqual({ error: 'Wait a minute before asking for another code.' });

    auth.resend.mockResolvedValueOnce({ data: {}, error: { status: 500, message: 'smtp down' } });
    const failed = await post({ email: 'new@example.com' });
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "Couldn't send a new code. Try again in a minute." });
    expect(console.error).toHaveBeenCalledWith('[auth] Sending a new sign-up code failed:', 'smtp down');
  });
});
