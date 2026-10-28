import { describe, it, expect } from 'vitest';
import { PLANS, type LimitReached, type PlanId, type UsageSummary } from '@/app/_shared/lib/usage/plans';
import { askForMore, formatBillingDate, formatResetDate, limitMessage, upgradeHint, featureMessage, meterLabel, reAuditNote } from '@/app/_shared/lib/usage/usageCopy';

const reached = (over: Partial<LimitReached> = {}): LimitReached =>
  ({ kind: 'search', plan: 'pro', limit: 25, resetsAt: '2026-11-14T00:00:00.000Z', ...over });

describe('limitMessage', () => {
  it('says how many were used and when they reset, in the spec words', () =>
    expect(limitMessage(reached())).toBe("You've used your 25 searches. They reset on Nov 14."));
  it('groups thousands', () =>
    expect(limitMessage(reached({ kind: 'audit', plan: 'agency', limit: 1000, resetsAt: '2026-12-01T00:00:00.000Z' })))
      .toBe("You've used your 1,000 audits. They reset on Dec 1."));
  it('reads naturally for an allowance of one', () =>
    expect(limitMessage(reached({ plan: 'free', limit: 1, resetsAt: '2026-11-26T15:00:00.000Z' })))
      .toBe("You've used your search. You get another on Nov 26."));
  it('never calls the 30 days a month', () =>
    expect(limitMessage(reached({ kind: 'audit', plan: 'free', limit: 2, resetsAt: '2026-11-26T15:00:00.000Z' })))
      .toBe("You've used your 2 audits. They reset on Nov 26."));
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
    expect(meterLabel(summary(0, 0))).toEqual({ text: '2 of 2 audits left', empty: false });
    expect(meterLabel(summary(0, 50, 'pro'))).toEqual({ text: '200 of 250 audits left', empty: false });
  });
  it('says none are left, and until when', () => expect(meterLabel(summary(1, 0))).toEqual({ text: 'No searches left until Nov 1', empty: true }));
  it('never goes below zero', () => expect(meterLabel(summary(0, 9))?.text).toBe('No audits left until Nov 1'));
  it('shows nothing for an account without limits', () => expect(meterLabel(summary(3, 3, 'owner'))).toBeNull());
});

describe('reAuditNote', () => {
  const summary = (audit: number, plan: PlanId = 'free'): UsageSummary => ({
    plan, resetsAt: '2026-11-01T00:00:00.000Z',
    usage: { search: { used: 0, limit: PLANS[plan].limits.search }, audit: { used: audit, limit: PLANS[plan].limits.audit }, email_lookup: { used: 0, limit: PLANS[plan].limits.email_lookup } },
  });
  it('says a Re-audit uses an audit, and how many are left', () =>
    expect(reAuditNote(summary(0))).toBe('A Re-audit measures the site afresh and uses one of your audits. You have 2 left until Nov 1.'));
  it('says when it is the last one', () =>
    expect(reAuditNote(summary(1))).toBe('A Re-audit measures the site afresh and uses your last audit until Nov 1.'));
  it('asks nothing when none are left: the limit message explains', () => expect(reAuditNote(summary(2))).toBeNull());
  it('asks nothing of an account without limits', () => expect(reAuditNote(summary(5, 'owner'))).toBeNull());
});

describe('featureMessage for per-user settings', () => {
  it('names the new features', () => {
    expect(featureMessage('mailbox')).toBe('Sending from your own mailbox comes with the Pro and Agency plans.');
    expect(featureMessage('hubspot')).toBe('The HubSpot handoff comes with the Pro and Agency plans.');
    expect(featureMessage('branding')).toBe('Your own branding on reports comes with the Pro and Agency plans.');
  });
});

describe('askForMore', () => {
  it('starts the feedback message a tester sends when they run out', () => {
    expect(askForMore(reached({ kind: 'audit', plan: 'free', limit: 2 }))).toBe("I've used all my audits. Could I have more for the beta?");
    expect(askForMore(reached({ kind: 'search', plan: 'free', limit: 1 }))).toBe("I've used all my searches. Could I have more for the beta?");
    expect(askForMore(reached({ kind: 'email_lookup', plan: 'free', limit: 0 }))).toBe("I'd like to try email lookups during the beta.");
  });

  it('asks to try a paid feature', () => {
    expect(askForMore('export')).toBe("I'd like to try exporting to CSV and Google Sheets during the beta.");
    expect(askForMore('hubspot')).toBe("I'd like to try the HubSpot handoff during the beta.");
  });
});
