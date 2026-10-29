// The sign-up page: for anyone while sign-ups are open, and for invited addresses
// while they're closed, since accounts are made only here.

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
  it('lets an invited address make its account while sign-ups are closed', async () => {
    vi.stubEnv('SIGNUPS_OPEN', '');
    const html = await open({ callbackUrl: '/plans' });
    expect(redirect).not.toHaveBeenCalled();
    expect(html).toContain('Create your Auditely account');
    expect(html).toContain('Auditely is invite-only for now. Use the email you were invited with.');
    expect(html).toContain(`href="/login?callbackUrl=%2Fplans"`);
  });

  it('asks for an email and a password to make an account once sign-ups are open', async () => {
    vi.stubEnv('SIGNUPS_OPEN', 'true');
    const html = await open({ callbackUrl: '/plans' });
    expect(redirect).not.toHaveBeenCalled();
    expect(html).toContain('Create your Auditely account');
    expect(html).toContain('type="password"');
    expect(html).toContain(`href="/login?callbackUrl=%2Fplans"`);
  });
});
