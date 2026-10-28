// The signed-in app's pages: everyone signed in has the Feedback button at the
// bottom right of every page, and a signed-out visitor (the landing page) doesn't.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/app/_shared/lib/supabase/server', () => ({ getSession: async () => session.current }));
vi.mock('@/app/_shared/lib/usage/usage', () => ({ usageSummary: async () => null }));
vi.mock('@/app/_shared/lib/settings/connections', () => ({ connectionsFor: async () => null }));
vi.mock('@/app/_shared/lib/settings/profileCard', () => ({ profileCardFor: async () => null }));

const { default: AppLayout } = await import('@/app/(app)/layout');

const render = async () => renderToStaticMarkup(await AppLayout({ children: 'page' }));

beforeEach(() => {
  session.current = null;
});

describe('the signed-in app layout', () => {
  it('gives everyone signed in the Feedback button', async () => {
    session.current = { db: {}, account: { id: 'u2', email: 'tester@x.com', isOwner: false } };
    const html = await render();
    expect(html).toMatch(/<button[^>]*>[\s\S]*Feedback[\s\S]*<\/button>/);
    expect(html).toContain('page');
  });

  it('leaves it off the landing page a signed-out visitor sees', async () => {
    const html = await render();
    expect(html).not.toContain('Feedback');
    expect(html).toContain('page');
  });
});
