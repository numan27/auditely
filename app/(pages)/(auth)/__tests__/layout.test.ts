// The sign-in and sign-up pages' top bar: the landing page's logo, in the
// landing page's column, so the logo stays put from the home page to sign-up.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AuthLayout from '@/app/(pages)/(auth)/layout';
import { LandingHeader } from '@/app/_shared/components/landing/landingHeader';
import { wrapClasses } from '@/app/_shared/components/landing/landingStyles';

const header = (html: string) => html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
const logo = (html: string) => html.match(/<a[^>]*href="\/"[\s\S]*?<\/a>/)?.[0] ?? '';

describe('the sign-in pages’ top bar', () => {
  const auth = header(renderToStaticMarkup(createElement(AuthLayout, null, createElement('p', null, 'The form'))));
  const landing = header(renderToStaticMarkup(createElement(LandingHeader)));

  it('sits in the landing page’s column, at its height', () => {
    expect(auth).toContain(wrapClasses);
    expect(auth).toContain('h-[72px]');
  });

  it('has the landing page’s logo', () => {
    expect(logo(auth)).not.toBe('');
    expect(logo(auth)).toBe(logo(landing));
  });
});
