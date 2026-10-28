import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoadFailed } from '@/app/_shared/components/auditely/loadFailed/loadFailed';

describe('LoadFailed', () => {
  it('says what failed and why, with a way to try again', () => {
    const html = renderToStaticMarkup(
      createElement(LoadFailed, { title: "Couldn't load your saved searches", message: 'Check your connection and try again.', onRetry: () => {} })
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Couldn&#x27;t load your saved searches');
    expect(html).toContain('Check your connection and try again.');
    expect(html).toMatch(/<button[^>]*>(?:(?!<\/button>).)*Try again/);
  });
});
