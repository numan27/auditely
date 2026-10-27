import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlansView } from '@/app/_shared/components/auditely/plansView/plansView';
import type { UsageSummary } from '@/app/_shared/lib/usage/plans';

const RESETS = '2026-11-01T00:00:00.000Z';
const freeSummary = (search: number, audit: number): UsageSummary => ({
  plan: 'free',
  resetsAt: RESETS,
  usage: { search: { used: search, limit: 1 }, audit: { used: audit, limit: 5 }, email_lookup: { used: 0, limit: 0 } },
});
const unlimited = { used: 0, limit: null };
const ownerSummary: UsageSummary = { plan: 'owner', resetsAt: RESETS, usage: { search: unlimited, audit: unlimited, email_lookup: unlimited } };

describe('PlansView', () => {
  it('shows this month for a Free account and marks its plan', () => {
    const html = renderToStaticMarkup(createElement(PlansView, { summary: freeSummary(1, 2) }));
    expect(html).toContain('Your plan: Free. This month&#x27;s allowances reset on Nov 1.');
    expect(html).toContain('1 of 1 search used');
    expect(html).toContain('2 of 5 audits used');
    expect(html).not.toContain('email lookups used');
    expect(html).toContain('$24 a month');
    expect(html).toContain('or $590 a year');
    expect(html).toContain('1,000 audits a month');
    expect(html).toContain('1 search a month');
    expect(html).toContain('No email lookups');
    expect(html).toContain('100 email lookups a month');
    expect(html).toContain('Your plan');
    expect(html).toContain('Coming soon');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="2"');
  });

  it("marks a tester's Pro plan and leaves no Coming soon on it", () => {
    const pro: UsageSummary = {
      plan: 'pro',
      resetsAt: RESETS,
      usage: { search: { used: 3, limit: 25 }, audit: { used: 40, limit: 250 }, email_lookup: { used: 7, limit: 100 } },
    };
    const html = renderToStaticMarkup(createElement(PlansView, { summary: pro }));
    expect(html).toContain('Your plan: Pro.');
    expect(html).toContain('7 of 100 email lookups used');
    // Agency is the only paid plan left to offer
    expect(html.match(/Coming soon/g)).toHaveLength(1);
  });

  it('tells the owner there are no limits', () => {
    const html = renderToStaticMarkup(createElement(PlansView, { summary: ownerSummary }));
    expect(html).toContain('Your account has no limits.');
    expect(html).not.toContain('used</');
  });

  it('says when usage could not be loaded', () =>
    expect(renderToStaticMarkup(createElement(PlansView, { summary: null }))).toContain(
      'Couldn&#x27;t load this month&#x27;s usage. Refresh the page to try again.'
    ));

  it('lists branding, mailbox and HubSpot as paid features', () => {
    const html = renderToStaticMarkup(createElement(PlansView, { summary: freeSummary(0, 0) }));
    for (const label of ['Your name and logo on reports', 'Send from your mailbox', 'HubSpot handoff']) expect(html).toContain(label);
  });
});
