// The screen shown while a page loads: Auditely's gauge measuring, rings going out
// behind it and a bar sliding under the name, still for anyone who asked for less motion.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageLoader } from '@/app/_shared/components/auditely/pageLoader/pageLoader';
import Loading from '@/app/loading';

const html = renderToStaticMarkup(createElement(PageLoader));
const styles = readFileSync('app/_shared/components/auditely/pageLoader/pageLoader.module.scss', 'utf8');

describe('PageLoader', () => {
  it('tells a screen reader the page is loading', () => {
    expect(html).toMatch(/role="status"/);
    expect(html).toMatch(/<span class="sr-only">Loading Auditely<\/span>/);
  });

  it("draws Auditely's mark with its needle apart, so the needle can sweep", () => {
    expect(html).toContain('d="M6.5 16a5.5 5.5 0 1 1 11 0"');
    expect(html).toMatch(/<path[^>]*class="[^"]*needle[^"]*"[^>]*d="M12 16l3.2-4.2"/);
    expect(html).toContain('>Auditely<');
  });

  it('holds still for a visitor who asked for less motion', () => {
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  });

  it('is the loading screen for every page', () => {
    expect(renderToStaticMarkup(createElement(Loading))).toBe(html);
  });
});
