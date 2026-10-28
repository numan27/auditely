// The owner's weekly numbers in Settings: free audits, new accounts and how far
// they got, for the last 7 and 30 days.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GrowthSection } from '@/app/_shared/components/auditely/settingsView/growthSection';
import type { GrowthCounts } from '@/app/_shared/lib/growth/funnel';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const section = (counts: GrowthCounts[] | null) => renderToStaticMarkup(createElement(GrowthSection, { counts }));

const WEEK: GrowthCounts = { days: 7, freeAudits: 12, kept: 3, accounts: 4, searched: 3, audited: 2, paying: 1, emailed: 0 };
const MONTH: GrowthCounts = { days: 30, freeAudits: 40, kept: 9, accounts: 10, searched: 7, audited: 5, paying: 2, emailed: 1 };

describe('GrowthSection', () => {
  it('shows each step for the last 7 and 30 days, as a share of the new accounts', () => {
    const page = text(section([WEEK, MONTH]));
    expect(section([WEEK, MONTH])).toMatch(/<h2[^>]*>Growth<\/h2>/);
    expect(page).toContain('Last 7 days Last 30 days');
    expect(page).toContain('Free audits run 12 40');
    expect(page).toContain('Kept by signing up 3 9');
    expect(page).toContain('New accounts 4 10');
    expect(page).toContain('Ran a search 3 (75%) 7 (70%)');
    expect(page).toContain('Audited a website 2 (50%) 5 (50%)');
    expect(page).toContain('Pay for Pro or Agency 1 (25%) 2 (20%)');
    expect(page).toContain('Emailed a lead from Auditely 0 (0%) 1 (10%)');
  });

  it('shows no share when there are no new accounts', () => {
    expect(text(section([{ ...WEEK, accounts: 0, searched: 0, audited: 0, paying: 0, emailed: 0 }, MONTH]))).toContain('Ran a search 0 7 (70%)');
  });

  it("says what isn't counted, and where visitors are", () => {
    const page = text(section([WEEK, MONTH]));
    expect(page).toContain("Your own account isn't counted.");
    expect(page).toContain('Free accounts copy their emails to send them, so only emails sent from Auditely are counted.');
    expect(page).toContain('Visitors, and the sites they came from, are in Vercel Web Analytics');
  });

  it("says when the numbers couldn't be read", () => {
    expect(text(section(null))).toContain("Couldn't load the numbers. Refresh to try again.");
  });
});
