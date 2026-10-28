// The owner's view of the free audit: how many visitors used it today against
// the daily cap, each audit's site and whether it was kept, and what's wrong
// when free audits are off or can't run.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FreeAuditsSection, type FreeAuditsSummary } from '@/app/_shared/components/auditely/settingsView/freeAuditsSection';
import type { FreeAuditListing } from '@/app/_shared/lib/freeAudit/freeAuditStore';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const section = (freeAudits: FreeAuditsSummary) => renderToStaticMarkup(createElement(FreeAuditsSection, { freeAudits }));
const on = (today: FreeAuditListing[] | null): FreeAuditsSummary => ({ state: 'on', cap: 200, missing: [], today });

const FIRST: FreeAuditListing[] = [
  { website: 'https://www.smile-dental.com/', createdAt: '2026-10-28T14:05:00.000Z', status: 'running', kept: false },
  { website: 'https://acme.studio/', createdAt: '2026-10-28T13:40:00.000Z', status: 'done', kept: true },
  { website: 'https://bakery.example/', createdAt: '2026-10-28T09:02:00.000Z', status: 'done', kept: false },
];
const filler = (i: number): FreeAuditListing => ({
  website: `https://site-${i}.example/`, createdAt: '2026-10-28T08:00:00.000Z', status: 'done', kept: false,
});

describe('FreeAuditsSection', () => {
  it("shows today's count against the cap and each audit", () => {
    const html = section(on([...FIRST, ...Array.from({ length: 34 }, (_, i) => filler(i))]));
    expect(html).toMatch(/<h2[^>]*>Free audits<\/h2>/);
    expect(text(html)).toContain('37 of 200 free audits used today.');
    // Each audit: its site, when (the browser's own time; the server's in UTC), and what became of it
    expect(text(html)).toContain('smile-dental.com 2:05 PM UTC Running');
    expect(text(html)).toContain('acme.studio 1:40 PM UTC Kept');
    expect(text(html)).toContain('bakery.example 9:02 AM UTC Not kept');
    expect(html).toContain('dateTime="2026-10-28T14:05:00.000Z"');
    expect(html.match(/<li/g)).toHaveLength(37);
  });

  it('says when free audits are off', () => {
    expect(text(section({ state: 'off', cap: null, missing: [], today: [] }))).toContain('Free audits are off.');
    expect(text(section({ state: 'off', cap: null, missing: [], today: [] }))).not.toContain('used today');
    // Turned off part-way through the day: today's audits still show
    expect(text(section({ state: 'off', cap: null, missing: [], today: FIRST.slice(1, 2) }))).toContain('acme.studio 1:40 PM UTC Kept');
  });

  it("names what's missing when free audits are on but can't run", () => {
    const html = section({ state: 'unavailable', cap: null, missing: ['FREE_AUDIT_IP_SALT', 'GOOGLE_PAGESPEED_API_KEY'], today: [] });
    expect(text(html)).toContain("Free audits aren't set up: FREE_AUDIT_IP_SALT, GOOGLE_PAGESPEED_API_KEY.");
  });

  it('says when there are none yet, or when they could not be read', () => {
    expect(text(section(on([])))).toContain('0 of 200 free audits used today.');
    expect(text(section(on([])))).toContain('No free audits yet today.');
    const failed = section(on(null));
    expect(text(failed)).toContain("Couldn't load today's free audits. Refresh to try again.");
    expect(text(failed)).not.toContain('used today');
  });
});
