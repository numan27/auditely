// The root layout sends every page's own markup in the first response: search
// engines, link previews and a visitor's first paint read it before any script runs.

import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// next/font needs Next's compiler; here each face is only its class name
vi.mock('next/font/google', () => {
  const face = (name: string) => () => ({ variable: `font-${name}`, className: name });
  return { Geist: face('geist'), Geist_Mono: face('geist-mono'), Bricolage_Grotesque: face('bricolage') };
});

// Vercel's script only runs in a browser; here it is a marker where it would load
vi.mock('@/app/_shared/components/providers/siteAnalytics', () => ({
  SiteAnalytics: () => createElement('i', { id: 'site-analytics' }),
}));

import RootLayout, { metadata } from '@/app/layout';
import { SHARE_DESCRIPTION } from '@/app/_shared/lib/seo/shareCopy';

describe('the root layout', () => {
  it("renders the page's markup on the server", () => {
    const html = renderToStaticMarkup(createElement(RootLayout, null, createElement('h1', null, 'Find clients whose websites need you.')));
    expect(html).toContain('<h1>Find clients whose websites need you.</h1>');
  });

  it('counts visits on every page', () => {
    const html = renderToStaticMarkup(createElement(RootLayout, null, createElement('p', null, 'A page')));
    expect(html).toContain('<i id="site-analytics"></i>');
  });

  it('gives every shared link a large image card with the site name', () => {
    expect(metadata.openGraph).toMatchObject({ type: 'website', siteName: 'Auditely', title: 'Auditely', description: SHARE_DESCRIPTION });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});
