// Google's terms keep its place details 30 days. A saved search older than that
// opens on a note saying why its leads are hidden, and a button that runs it again.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExpiredSearch } from '@/app/_shared/components/auditely/expiredSearch/expiredSearch';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const render = (count: number) => renderToStaticMarkup(createElement(ExpiredSearch, { count, onRefresh: () => {} }));

describe('ExpiredSearch', () => {
  it("says why the leads are hidden, that each keeps its audit, and what running it again costs", () => {
    const html = render(12);
    expect(text(html)).toContain('This search is over 30 days old');
    expect(text(html)).toContain(
      "Google's details for its 12 businesses are kept for 30 days, so they're hidden. Refresh the search to see them again: each business Google still lists keeps its audit. It counts as one of your searches."
    );
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>(?:(?!<\/button>).)*Refresh this search/);
  });

  it('counts one business as one', () => {
    expect(text(render(1))).toContain("Google's details for its 1 business are kept for 30 days");
  });

  it('offers a fresh look when the search found nothing then', () => {
    const html = render(0);
    expect(text(html)).toContain('It found no businesses then. Refresh the search to look again. It counts as one of your searches.');
    expect(text(html)).toContain('Refresh this search');
  });
});
