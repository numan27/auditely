import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CollapseAllButton } from '@/app/_shared/components/auditely/collapseAll/collapseAll';

const button = (count: number) => renderToStaticMarkup(createElement(CollapseAllButton, { count, onClick: () => {} }));

describe('CollapseAllButton', () => {
  it('is shown for a list of two or more cards', () => {
    expect(button(2)).toContain('Collapse all');
    expect(button(10)).toContain('Collapse all');
  });

  it('is left out for a list of one card, or none', () => {
    expect(button(1)).toBe('');
    expect(button(0)).toBe('');
  });
});
