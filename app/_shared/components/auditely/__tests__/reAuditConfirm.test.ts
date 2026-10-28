// Re-audit on a plan with a limit asks first: it measures the site again and uses an audit.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReAuditConfirm } from '@/app/_shared/components/auditely/reAuditConfirm/reAuditConfirm';

const note = 'A Re-audit measures the site afresh and uses one of your audits. You have 2 left until Nov 1.';
const html = renderToStaticMarkup(createElement(ReAuditConfirm, { businessName: 'Smile Dental', note, onConfirm() {}, onClose() {} }));
const text = html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

describe('ReAuditConfirm', () => {
  it('names the business and says what a Re-audit costs', () => {
    expect(html).toContain('role="dialog"');
    expect(text).toContain('Re-audit Smile Dental?');
    expect(text).toContain(note);
  });

  it('goes ahead with Re-audit, or cancels', () => {
    expect(html).toMatch(/<button[^>]*>[\s\S]*Re-audit[\s\S]*?<\/button>/);
    expect(html).toMatch(/<button[^>]*>[\s\S]*Cancel[\s\S]*?<\/button>/);
  });
});
