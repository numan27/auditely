// A new account's first visit: the empty workspace says what to do first and what
// this month's plan allows; the owner, who has no limits, keeps today's words.

import { describe, it, expect } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FirstSearch } from '@/app/_shared/components/auditely/recentSearches/recentSearches';
import { NoUrlAudits } from '@/app/_shared/components/auditely/urlAuditPanel/urlAuditPanel';
import { UsageContext } from '@/app/_shared/lib/hooks/useUsage';
import type { PlanId, UsageSummary } from '@/app/_shared/lib/usage/plans';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const summary = (plan: PlanId, search: number | null, audit: number | null): UsageSummary => ({
  plan,
  resetsAt: '2026-11-01T00:00:00.000Z',
  usage: { search: { used: 0, limit: search }, audit: { used: 0, limit: audit }, email_lookup: { used: 0, limit: search && 0 } },
});
const withUsage = (value: UsageSummary | null, el: ReactElement) =>
  renderToStaticMarkup(createElement(UsageContext.Provider, { value: value && { summary: value, refresh() {}, promptUpgrade() {} } }, el));

const OWNER = summary('owner', null, null);
const OWNER_SEARCH = 'Enter a business type and a city.';
const OWNER_URL = 'Paste a prospect\'s website to see how it scores';

describe('the empty workspace', () => {
  it('tells a new account what to do first, with its allowance and when it renews', () => {
    const search = withUsage(summary('free', 1, 2), createElement(FirstSearch));
    expect(search).toMatch(/<h2[^>]*>Find your first clients<\/h2>/);
    expect(text(search)).toContain(
      "Search a business type and a city, like dentist in Austin, TX. You'll get every local business we can find, with its website audited on request."
    );
    expect(text(search)).toContain('Your Free plan includes 1 search and 2 audits. They renew on Nov 1.');
    expect(text(withUsage(summary('pro', 25, 250), createElement(FirstSearch)))).toContain(
      'Your Pro plan includes 25 searches and 250 audits. They renew on Nov 1.'
    );
    expect(text(withUsage(summary('agency', 80, 1000), createElement(FirstSearch)))).toContain(
      'Your Agency plan includes 80 searches and 1,000 audits. They renew on Nov 1.'
    );

    const url = withUsage(summary('free', 1, 2), createElement(NoUrlAudits));
    expect(text(url)).toBe("Paste a prospect's website, or your own, to audit it. Audits you run show here.");
  });

  it('keeps the owner copy for an account with no limits', () => {
    const search = text(withUsage(OWNER, createElement(FirstSearch)));
    expect(search).toContain(OWNER_SEARCH);
    expect(search).not.toContain('Find your first clients');
    expect(search).not.toContain('plan includes');
    const url = text(withUsage(OWNER, createElement(NoUrlAudits)));
    expect(url).toContain(OWNER_URL);
    expect(url).not.toContain('or your own');
  });

  it("keeps today's copy when the plan isn't known, as in the demo", () => {
    expect(text(withUsage(null, createElement(FirstSearch)))).toContain(OWNER_SEARCH);
    expect(text(withUsage(null, createElement(NoUrlAudits)))).toContain(OWNER_URL);
  });
});
