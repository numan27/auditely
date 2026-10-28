// What a search and an audit look like while they run: a radar over the city for
// a search, a scan down the website for an audit. Each says what is happening in
// words, and neither claims a count, a percentage or a result it doesn't have.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchRadar, pinDelay, searchSteps } from '@/app/_shared/components/auditely/searchRadar/searchRadar';
import { AuditScan, AUDIT_CHECKS } from '@/app/_shared/components/auditely/auditScan/auditScan';
import { AuditPanel } from '@/app/_shared/components/auditely/auditPanel/auditPanel';
import type { Business } from '@/app/_shared/lib/types/auditely';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

describe('the search radar', () => {
  it('reaches each pin when the sweep, starting at the top and turning clockwise, passes it', () => {
    // The map is 2.6 times wider than tall, so the right edge's middle is a quarter turn round
    expect(pinDelay(50, 0)).toBe('0.00s');
    expect(pinDelay(100, 50)).toBe('0.90s');
    expect(pinDelay(50, 100)).toBe('1.80s');
    expect(pinDelay(0, 50)).toBe('2.70s');
  });

  it('names the search it is running, and says what it does next', () => {
    expect(searchSteps(' Dentists ', ' Austin, TX ')).toEqual([
      'Looking for dentists in Austin, TX',
      'Reading each Google Maps listing',
      'Collecting websites, phone numbers and ratings',
      'Putting the list together',
    ]);
    expect(searchSteps()[0]).toBe('Looking for businesses');
    expect(searchSteps('dentists', ' ')[0]).toBe('Looking for businesses');
  });

  it('tells a screen reader a search is running, and starts on the first step', () => {
    const html = renderToStaticMarkup(createElement(SearchRadar, { niche: 'Plumbers', location: 'Leeds' }));
    expect(html).toMatch(/role="status"/);
    expect(text(html)).toContain('Finding businesses');
    expect(text(html)).toContain('Looking for plumbers in Leeds…');
    expect(text(html)).not.toContain('Reading each Google Maps listing');
    // The map is a picture: ten pins, hidden from screen readers
    expect(html.match(/<svg[^>]*viewBox="0 0 22 28"/g)).toHaveLength(10);
    expect(html).toMatch(/<div[^>]*aria-hidden="true"[^>]*>[\s\S]*<svg[^>]*viewBox="0 0 22 28"/);
  });
});

describe('the audit scan', () => {
  const html = renderToStaticMarkup(
    createElement(AuditScan, { domain: 'smiledental.com', title: 'Auditing smiledental.com…', detail: 'This takes about a minute.' })
  );

  it('draws the website being audited, with its address in the bar', () => {
    expect(html).toMatch(/<div[^>]*aria-hidden="true"[^>]*>[\s\S]*smiledental\.com/);
    expect(text(html)).toContain('Auditing smiledental.com…');
    expect(text(html)).toContain('This takes about a minute.');
  });

  it('lists what the audit checks, without marking any of them done', () => {
    expect(AUDIT_CHECKS).toEqual(['Mobile speed', 'Desktop speed', 'SEO', 'SSL', 'AI search', 'Contact forms', 'Broken links']);
    for (const check of AUDIT_CHECKS) expect(text(html)).toContain(check);
    expect(text(html)).not.toMatch(/%|✓|done|passed/i);
  });
});

describe('a card being audited', () => {
  const business = { id: 'b1', name: 'Smile Dental', website: 'https://www.smiledental.com/' } as Business;
  const state = { audit: null, report: null, auditStatus: 'loading', auditError: null, reportStatus: 'idle', queued: false };
  const panel = (props: Partial<Parameters<typeof AuditPanel>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(AuditPanel, {
        business,
        state: state as unknown as Parameters<typeof AuditPanel>[0]['state'],
        crm: {} as Parameters<typeof AuditPanel>[0]['crm'],
        mail: {} as Parameters<typeof AuditPanel>[0]['mail'],
        ...props,
      })
    );

  it('shows the scan of its website, with the same words as before', () => {
    const html = panel();
    expect(text(html)).toContain('Auditing smiledental.com…');
    expect(text(html)).toContain('Speed tests run on mobile and desktop, so this takes about a minute.');
    expect(text(html)).toContain('Contact forms');
  });

  it("keeps the plain line for a site that's only queued", () => {
    const html = panel({ state: { ...state, auditStatus: 'idle', queued: true } as unknown as Parameters<typeof AuditPanel>[0]['state'] });
    expect(text(html)).toContain('Queued for audit');
    expect(text(html)).not.toContain('Contact forms');
  });
});
