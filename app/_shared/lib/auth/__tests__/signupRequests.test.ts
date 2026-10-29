// The browser's side of signing up: each request goes to its route with what it
// needs, and every answer, a failed or unreadable one included, comes back as
// something the form can show.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { confirmCode, requestSignup, resendCode } from '@/app/_shared/lib/auth/signupRequests';
import { UNREACHABLE } from '@/app/_shared/lib/utils/jsonRequest';

const fetchMock = vi.fn();
const answer = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
const sent = () => ({ url: fetchMock.mock.calls.at(-1)?.[0], body: JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body) });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('requestSignup', () => {
  it('sends the email, password and where to go, and says the code is on its way', async () => {
    answer(200, { sent: true });
    expect(await requestSignup('new@example.com', 'pw-12345678', '/plans')).toEqual({ ok: true, sent: true });
    expect(sent()).toEqual({ url: '/api/auth/signup', body: { email: 'new@example.com', password: 'pw-12345678', callbackUrl: '/plans' } });
  });

  it('passes on where to go when the account was signed straight in', async () => {
    answer(200, { next: '/audit' });
    expect(await requestSignup('new@example.com', 'pw-12345678', '/')).toEqual({ ok: true, next: '/audit' });
  });

  it("passes on the route's refusal, and which field it's about", async () => {
    answer(409, { error: 'This email already has an account. Sign in instead.' });
    expect(await requestSignup('a@b.co', 'pw-12345678', '/')).toEqual({ ok: false, error: 'This email already has an account. Sign in instead.' });
    answer(400, { error: 'Use 72 characters or fewer.', field: 'password' });
    expect(await requestSignup('a@b.co', 'x', '/')).toEqual({ ok: false, error: 'Use 72 characters or fewer.', field: 'password' });
  });

  it('says what happened when there was no answer, or none it could read', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect(await requestSignup('a@b.co', 'pw-12345678', '/')).toEqual({ ok: false, error: UNREACHABLE });
    answer(504, '<html>timeout</html>');
    expect(await requestSignup('a@b.co', 'pw-12345678', '/')).toEqual({ ok: false, error: "Couldn't create your account. Try again in a minute." });
  });
});

describe('confirmCode', () => {
  it('sends the code with the email and password, and passes on where to go', async () => {
    answer(200, { next: '/plans' });
    expect(await confirmCode('new@example.com', 'pw-12345678', '482917', '/plans')).toEqual({ ok: true, next: '/plans' });
    expect(sent()).toEqual({
      url: '/api/auth/signup/code',
      body: { email: 'new@example.com', password: 'pw-12345678', code: '482917', callbackUrl: '/plans' },
    });
  });

  it('passes on a wrong code, and falls back when the answer is unreadable', async () => {
    answer(400, { error: 'That code is wrong or has expired. Check it, or send yourself a new one.' });
    expect(await confirmCode('a@b.co', 'pw', '000000', '/')).toEqual({
      ok: false,
      error: 'That code is wrong or has expired. Check it, or send yourself a new one.',
    });
    answer(200, { nothing: true });
    expect(await confirmCode('a@b.co', 'pw', '000000', '/')).toEqual({ ok: false, error: "Couldn't confirm your email. Try again in a minute." });
  });
});

describe('resendCode', () => {
  it('asks for a new code for the email', async () => {
    answer(200, { sent: true });
    expect(await resendCode('new@example.com', '/')).toEqual({ ok: true });
    expect(sent()).toEqual({ url: '/api/auth/signup/resend', body: { email: 'new@example.com', callbackUrl: '/' } });
  });

  it('passes on a refusal', async () => {
    answer(429, { error: 'Wait a minute before asking for another code.' });
    expect(await resendCode('a@b.co', '/')).toEqual({ ok: false, error: 'Wait a minute before asking for another code.' });
    answer(500, 'oops');
    expect(await resendCode('a@b.co', '/')).toEqual({ ok: false, error: "Couldn't send a new code. Try again in a minute." });
  });
});
