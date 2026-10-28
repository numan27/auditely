// The emailed sign-in link lands here first: opening it signs nobody in, so an
// email scanner that opens it before the person does can't use it up. Continue
// posts the link's details back to the callback, which signs in.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  })
);
vi.mock('next/navigation', () => ({ redirect }));

const { default: ContinuePage } = await import('@/app/(pages)/(auth)/auth/continue/page');

const open = async (query: Record<string, string | string[]>) =>
  renderToStaticMarkup(await ContinuePage({ searchParams: Promise.resolve(query) }));

const hidden = (html: string, name: string) => new RegExp(`<input type="hidden" name="${name}" value="([^"]*)"`).exec(html)?.[1];

beforeEach(() => {
  redirect.mockClear();
});

describe('ContinuePage', () => {
  it("posts the link's details to the callback with one button", async () => {
    const html = await open({ next: '/searches', keep: 'f1.sig', token_hash: 'h1', type: 'email' });
    const form = /<form[^>]*>/.exec(html)?.[0] ?? '';
    expect(form).toContain('method="post"');
    expect(form).toContain('action="/auth/callback"');
    expect(hidden(html, 'token_hash')).toBe('h1');
    expect(hidden(html, 'type')).toBe('email');
    expect(hidden(html, 'next')).toBe('/searches');
    expect(hidden(html, 'keep')).toBe('f1.sig');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>(?:(?!<\/button>).)*Continue/);
  });

  it('says why there is a button to press', async () => {
    expect(await open({ token_hash: 'h1', type: 'email' })).toContain('email security scanners');
  });

  it('leaves out what the link left out', async () => {
    const html = await open({ token_hash: 'h1', type: 'email' });
    expect(hidden(html, 'next')).toBeUndefined();
    expect(hidden(html, 'keep')).toBeUndefined();
  });

  it('sends a link with nothing to sign in with back to the login', async () => {
    await expect(open({ next: '/' })).rejects.toThrow('NEXT_REDIRECT /login?error=link');
    await expect(open({ token_hash: 'h1', type: 'recovery' })).rejects.toThrow('NEXT_REDIRECT /login?error=link');
  });

  it('takes the first of a repeated parameter', async () => {
    expect(hidden(await open({ token_hash: ['h1', 'h2'], type: 'email' }), 'token_hash')).toBe('h1');
  });
});
