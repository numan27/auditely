// The sign-up page: only while sign-ups are open; otherwise it's the login, and
// where the visitor was headed comes along either way.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  })
);
vi.mock('next/navigation', () => ({ redirect }));

const { default: SignupPage } = await import('@/app/(pages)/(auth)/signup/page');

const open = async (query: { callbackUrl?: string } = {}) =>
  renderToStaticMarkup(await SignupPage({ searchParams: Promise.resolve(query) }));

beforeEach(() => {
  redirect.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe('SignupPage', () => {
  it('sends someone to sign in when sign-ups are closed', async () => {
    vi.stubEnv('SIGNUPS_OPEN', '');
    await expect(open()).rejects.toThrow('NEXT_REDIRECT /login');
    await expect(open({ callbackUrl: '/plans' })).rejects.toThrow('NEXT_REDIRECT /login?callbackUrl=%2Fplans');
  });

  it('asks for an email to make an account once sign-ups are open', async () => {
    vi.stubEnv('SIGNUPS_OPEN', 'true');
    const html = await open({ callbackUrl: '/plans' });
    expect(redirect).not.toHaveBeenCalled();
    expect(html).toContain('Create your Auditely account');
    expect(html).toContain(`href="/login?callbackUrl=%2Fplans"`);
  });
});
