import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlansView, type PlansBilling } from '@/app/_shared/components/auditely/plansView/plansView';
import type { UsageSummary } from '@/app/_shared/lib/usage/plans';

const RESETS = '2026-11-01T00:00:00.000Z';
const freeSummary = (search: number, audit: number): UsageSummary => ({
  plan: 'free',
  resetsAt: RESETS,
  usage: { search: { used: search, limit: 1 }, audit: { used: audit, limit: 5 }, email_lookup: { used: 0, limit: 0 } },
});
const unlimited = { used: 0, limit: null };
const ownerSummary: UsageSummary = { plan: 'owner', resetsAt: RESETS, usage: { search: unlimited, audit: unlimited, email_lookup: unlimited } };
const proSummary: UsageSummary = {
  plan: 'pro',
  resetsAt: '2026-11-14T09:30:00.000Z',
  usage: { search: { used: 3, limit: 25 }, audit: { used: 40, limit: 250 }, email_lookup: { used: 7, limit: 100 } },
};
const yearly = {
  plan: 'pro', interval: 'year', status: 'active', anchor: '2026-03-14T09:30:00.000Z', periodEnd: '2027-03-14T09:30:00.000Z', endsAt: null,
} as const;

const base: PlansBilling = { ready: true, canBuy: true, subscription: null, interval: 'month', justSubscribed: false };
/** Before Stripe is set up, as the plans page was in Phase 3 */
const notReady: PlansBilling = { ...base, ready: false };
const free = freeSummary(0, 0);
const render = (summary: UsageSummary | null, billing: PlansBilling) => renderToStaticMarkup(createElement(PlansView, { summary, billing }));
/** The opening tag of the link that reads `label` */
const linkTo = (html: string, label: string) => html.match(new RegExp(`<a[^>]*>${label}</a>`))?.[0] ?? '';

describe('PlansView', () => {
  it('shows this month for a Free account and marks its plan', () => {
    const html = render(freeSummary(1, 2), notReady);
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
    const html = render(pro, notReady);
    expect(html).toContain('Your plan: Pro.');
    expect(html).toContain('7 of 100 email lookups used');
    // Agency is the only paid plan left to offer
    expect(html.match(/Coming soon/g)).toHaveLength(1);
  });

  it('tells the owner there are no limits', () => {
    const html = render(ownerSummary, { ...base, canBuy: false });
    expect(html).toContain('Your account has no limits.');
    expect(html).not.toContain('used</');
  });

  it('says when usage could not be loaded', () =>
    expect(render(null, base)).toContain(
      'Couldn&#x27;t load this month&#x27;s usage. Refresh the page to try again.'
    ));

  it('lists branding, mailbox and HubSpot as paid features', () => {
    const html = render(free, base);
    for (const label of ['Your name and logo on reports', 'Send from your mailbox', 'HubSpot handoff']) expect(html).toContain(label);
  });

  it('lets a Free account choose Pro or Agency, monthly by default', () => {
    const html = render(free, base);
    expect(html).toContain('Choose Pro');
    expect(html).toContain('Choose Agency');
    expect(html).toContain('$24 a month');
    expect(html).not.toContain('or $240 a year');
    expect(html).toContain('href="/plans?billing=yearly"');
    expect(linkTo(html, 'Monthly')).toContain('href="/plans"');
    expect(linkTo(html, 'Monthly')).toContain('aria-current="true"');
    expect(linkTo(html, 'Yearly')).not.toContain('aria-current');
    expect(html).toContain('Two months free with yearly billing.');
    expect(html).not.toContain('Coming soon');
  });

  it('shows yearly prices when yearly is picked', () => {
    const html = render(free, { ...base, interval: 'year' });
    expect(html).toContain('$240 a year');
    expect(html).toContain('$590 a year');
    expect(html).toContain('Two months free');
    expect(html).not.toContain('$24 a month');
    expect(linkTo(html, 'Yearly')).toContain('href="/plans?billing=yearly"');
    expect(linkTo(html, 'Yearly')).toContain('aria-current="true"');
  });

  it('sends a subscriber to Manage billing instead of Checkout', () => {
    const html = render(proSummary, { ...base, subscription: yearly });
    expect(html).toContain('Manage billing');
    expect(html).toContain('Change plan');
    expect(html).not.toContain('Choose Pro');
    expect(html).not.toContain('billing=yearly');
    expect(html).toContain('or $240 a year');
  });

  it('keeps "Coming soon" until Stripe is set up, and shows the owner no button', () => {
    const waiting = render(free, notReady);
    expect(waiting).toContain('Coming soon');
    expect(waiting).not.toContain('Choose');
    const owner = render(ownerSummary, { ...base, canBuy: false });
    expect(owner).not.toContain('Choose');
    expect(owner).not.toContain('Coming soon');
    expect(owner).not.toContain('Manage billing');
  });

  it('welcomes a new subscriber, or says the payment is on its way', () => {
    expect(render(proSummary, { ...base, subscription: yearly, justSubscribed: true })).toContain(
      'You&#x27;re on the Pro plan. Your new allowances start today.'
    );
    expect(render(free, { ...base, justSubscribed: true })).toContain(
      'Payment received. Your plan shows here once Stripe confirms it. Refresh the page in a minute.'
    );
    expect(render(free, base)).not.toContain('Payment received');
  });
});
