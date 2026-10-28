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

import RootLayout from '@/app/layout';

describe('the root layout', () => {
  it("renders the page's markup on the server", () => {
    const html = renderToStaticMarkup(createElement(RootLayout, null, createElement('h1', null, 'Find clients whose websites need you.')));
    expect(html).toContain('<h1>Find clients whose websites need you.</h1>');
  });
});
