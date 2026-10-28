import { describe, it, expect } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UsageMeter } from '@/app/_shared/components/auditely/usageMeter/usageMeter';
import { UpgradeModal } from '@/app/_shared/components/auditely/upgradeModal/upgradeModal';
import { UsageContext } from '@/app/_shared/lib/hooks/useUsage';
import type { UsageSummary } from '@/app/_shared/lib/usage/plans';

const freeSummary = (search: number, audit: number): UsageSummary => ({
  plan: 'free',
  resetsAt: '2026-11-01T00:00:00.000Z',
  usage: { search: { used: search, limit: 1 }, audit: { used: audit, limit: 5 }, email_lookup: { used: 0, limit: 0 } },
});
const withUsage = (summary: UsageSummary | null, el: ReactElement) =>
  renderToStaticMarkup(
    createElement(UsageContext.Provider, { value: summary && { summary, refresh() {}, promptUpgrade() {} } }, el)
  );

describe('UsageMeter', () => {
  it('shows what is left and links to the plans', () => {
    const html = withUsage(freeSummary(0, 2), createElement(UsageMeter));
    expect(html).toContain('3 of 5 audits left this month');
    expect(html).toContain('href="/plans"');
  });

  it('warns when an allowance is used up', () =>
    expect(withUsage(freeSummary(1, 0), createElement(UsageMeter))).toContain('No searches left this month'));

  it('shows no meter without limits or outside the app', () => {
    expect(withUsage(null, createElement(UsageMeter))).toBe('');
    const unlimited = { used: 0, limit: null };
    const owner: UsageSummary = { ...freeSummary(0, 0), plan: 'owner', usage: { search: unlimited, audit: unlimited, email_lookup: unlimited } };
    expect(withUsage(owner, createElement(UsageMeter))).toBe('');
  });
});

describe('UpgradeModal', () => {
  it('explains a limit and offers the next plan', () => {
    const html = renderToStaticMarkup(
      createElement(UpgradeModal, { prompt: { limit: { kind: 'search', plan: 'free', limit: 1, resetsAt: '2026-11-01T00:00:00.000Z' } }, onClose() {}, checkoutOpen: true })
    );
    expect(html).toContain('Monthly limit reached');
    expect(html).toContain('You&#x27;ve used this month&#x27;s search. You get another on Nov 1.');
    expect(html).toContain('Pro gives you 25 searches a month.');
    expect(html).toContain('See plans');
    expect(html).toContain('href="/plans"');
  });

  it('offers no plans above Agency, and the way on when one is given', () => {
    const html = renderToStaticMarkup(
      createElement(UpgradeModal, {
        prompt: {
          limit: { kind: 'email_lookup', plan: 'agency', limit: 400, resetsAt: '2026-11-01T00:00:00.000Z' },
          continueLabel: 'Search the website only',
          onContinue() {},
        },
        onClose() {},
        checkoutOpen: true,
      })
    );
    expect(html).not.toContain('See plans');
    expect(html).toContain('Search the website only');
  });

  it('explains a paid feature', () => {
    const html = renderToStaticMarkup(createElement(UpgradeModal, { prompt: { feature: 'export' }, onClose() {}, checkoutOpen: true }));
    expect(html).toContain('Not in your plan');
    expect(html).toContain('Exporting to CSV and Google Sheets comes with the Pro and Agency plans.');
    expect(html).toContain('See plans');
  });

  it('says a kind the plan never had is not in it', () => {
    const html = renderToStaticMarkup(
      createElement(UpgradeModal, { prompt: { limit: { kind: 'email_lookup', plan: 'free', limit: 0, resetsAt: '2026-11-01T00:00:00.000Z' } }, onClose() {}, checkoutOpen: true })
    );
    expect(html).toContain('Not in your plan');
    expect(html).toContain('Email lookups aren&#x27;t part of the Free plan.');
    expect(html).toContain('Pro gives you 100 email lookups a month.');
  });

  it('during the beta, says paid plans open after it and offers to ask for more instead', () => {
    const html = renderToStaticMarkup(
      createElement(UpgradeModal, { prompt: { limit: { kind: 'audit', plan: 'free', limit: 2, resetsAt: '2026-11-01T00:00:00.000Z' } }, onClose() {}, checkoutOpen: false })
    );
    expect(html).toContain('You&#x27;ve used your 2 audits this month. They reset on Nov 1.');
    expect(html).toContain('Pro gives you 250 audits a month.');
    expect(html).toContain('Paid plans open after the beta. Until then, ask for more and we&#x27;ll raise your limit if we can.');
    expect(html).toContain('Ask for more');
    expect(html).not.toContain('See plans');
    expect(html).not.toContain('href="/plans"');
  });

  it('during the beta, offers to ask to try a paid feature', () => {
    const html = renderToStaticMarkup(createElement(UpgradeModal, { prompt: { feature: 'export' }, onClose() {}, checkoutOpen: false }));
    expect(html).toContain('Ask to try it');
    expect(html).not.toContain('See plans');
  });

  it('keeps the way on when a prompt has one, during the beta too', () => {
    const html = renderToStaticMarkup(
      createElement(UpgradeModal, {
        prompt: {
          limit: { kind: 'email_lookup', plan: 'free', limit: 0, resetsAt: '2026-11-01T00:00:00.000Z' },
          continueLabel: 'Search the website only',
          onContinue() {},
        },
        onClose() {},
        checkoutOpen: false,
      })
    );
    expect(html).toContain('Search the website only');
    expect(html).toContain('Ask for more');
  });
});
