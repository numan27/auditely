import { describe, it, expect } from 'vitest';
import { PLANS, type LimitReached, type PlanId, type UsageSummary } from '@/app/_shared/lib/usage/plans';
import { formatBillingDate, formatResetDate, limitMessage, upgradeHint, featureMessage, meterLabel } from '@/app/_shared/lib/usage/usageCopy';

const reached = (over: Partial<LimitReached> = {}): LimitReached =>
  ({ kind: 'search', plan: 'pro', limit: 25, resetsAt: '2026-11-14T00:00:00.000Z', ...over });

describe('limitMessage', () => {
  it('says how many were used and when they reset, in the spec words', () =>
    expect(limitMessage(reached())).toBe("You've used your 25 searches this month. They reset on Nov 14."));
  it('groups thousands', () =>
    expect(limitMessage(reached({ kind: 'audit', plan: 'agency', limit: 1000, resetsAt: '2026-12-01T00:00:00.000Z' })))
      .toBe("You've used your 1,000 audits this month. They reset on Dec 1."));
  it('reads naturally for an allowance of one', () =>
    expect(limitMessage(reached({ plan: 'free', limit: 1, resetsAt: '2026-11-01T00:00:00.000Z' })))
      .toBe("You've used this month's search. You get another on Nov 1."));
  it('says when the plan never had any', () =>
    expect(limitMessage(reached({ kind: 'email_lookup', plan: 'free', limit: 0 }))).toBe("Email lookups aren't part of the Free plan."));
});

describe('formatResetDate', () => {
  it('uses the UTC date, not the local one', () => expect(formatResetDate('2026-11-01T00:00:00.000Z')).toBe('Nov 1'));
  it('formats a billing date with its year', () => expect(formatBillingDate('2027-03-14T09:30:00.000Z')).toBe('Mar 14, 2027'));
  it('keeps a billing date in UTC', () => expect(formatBillingDate('2026-11-01T00:30:00.000Z')).toBe('Nov 1, 2026'));
});

describe('upgradeHint', () => {
  it("names the next plan's allowance", () => {
    expect(upgradeHint(reached({ plan: 'free', limit: 1 }))).toBe('Pro gives you 25 searches a month.');
    expect(upgradeHint(reached())).toBe('Agency gives you 80 searches a month.');
    expect(upgradeHint(reached({ kind: 'email_lookup', plan: 'free', limit: 0 }))).toBe('Pro gives you 100 email lookups a month.');
  });
  it('has nothing above Agency', () => expect(upgradeHint(reached({ plan: 'agency', limit: 80 }))).toBeNull());
});

describe('featureMessage', () => {
  it('names the plans that have it', () => {
    expect(featureMessage('auditAll')).toBe('Audit all comes with the Pro and Agency plans.');
    expect(featureMessage('export')).toBe('Exporting to CSV and Google Sheets comes with the Pro and Agency plans.');
  });
});

describe('meterLabel', () => {
  const summary = (search: number, audit: number, plan: PlanId = 'free'): UsageSummary => ({
    plan, resetsAt: '2026-11-01T00:00:00.000Z',
    usage: { search: { used: search, limit: PLANS[plan].limits.search }, audit: { used: audit, limit: PLANS[plan].limits.audit }, email_lookup: { used: 0, limit: PLANS[plan].limits.email_lookup } },
  });
  it('shows the allowance closest to running out, audits on a tie', () => {
    expect(meterLabel(summary(0, 0))).toEqual({ text: '1 of 1 audit left this month', empty: false });
    expect(meterLabel(summary(0, 50, 'pro'))).toEqual({ text: '200 of 250 audits left this month', empty: false });
  });
  it('says none are left', () => expect(meterLabel(summary(1, 0))).toEqual({ text: 'No searches left this month', empty: true }));
  it('never goes below zero', () => expect(meterLabel(summary(0, 9))?.text).toBe('No audits left this month'));
  it('shows nothing for an account without limits', () => expect(meterLabel(summary(3, 3, 'owner'))).toBeNull());
});

describe('featureMessage for per-user settings', () => {
  it('names the new features', () => {
    expect(featureMessage('mailbox')).toBe('Sending from your own mailbox comes with the Pro and Agency plans.');
    expect(featureMessage('hubspot')).toBe('The HubSpot handoff comes with the Pro and Agency plans.');
    expect(featureMessage('branding')).toBe('Your own branding on reports comes with the Pro and Agency plans.');
  });
});
