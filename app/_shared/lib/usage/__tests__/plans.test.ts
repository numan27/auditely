import { describe, it, expect } from 'vitest';
import {
  PLANS, parsePlanOverrides, planFor, calendarMonth, allowanceWindow, usagePeriod, planHas, exhausted, readLimit, type UsageSummary,
} from '@/app/_shared/lib/usage/plans';

const yearly = {
  plan: 'pro', interval: 'year', status: 'active', anchor: '2026-03-14T09:30:00.000Z', periodEnd: '2027-03-14T09:30:00.000Z', endsAt: null,
} as const;

describe('parsePlanOverrides', () => {
  it('reads email:plan pairs, trimmed and lowercased', () => {
    expect(parsePlanOverrides(' Ann@X.com : PRO , bob@y.com:agency')).toEqual(
      new Map([['ann@x.com', 'pro'], ['bob@y.com', 'agency']]));
  });
  it('skips blanks, unknown plans and owner', () => {
    expect(parsePlanOverrides('a@x.com:gold, ,b@x.com,c@x.com:owner,d@x.com:free')).toEqual(new Map([['d@x.com', 'free']]));
    expect(parsePlanOverrides(undefined)).toEqual(new Map());
  });
});

describe('planFor', () => {
  const env = { PLAN_OVERRIDES: 'ann@x.com:pro' } as unknown as NodeJS.ProcessEnv;
  it('gives the owner no limits, whatever the overrides say', () => {
    expect(planFor({ email: 'ann@x.com', isOwner: true }, env).id).toBe('owner');
    expect(Object.values(PLANS.owner.limits)).toEqual([null, null, null]);
  });
  it('gives an overridden tester their plan, whatever the case', () =>
    expect(planFor({ email: 'ANN@x.com', isOwner: false }, env).id).toBe('pro'));
  it('puts everyone else on Free', () => expect(planFor({ email: 'zed@x.com', isOwner: false }, env).id).toBe('free'));
  it('takes the plan from a live subscription, before an override', () => {
    const overridden = { PLAN_OVERRIDES: 'tester@x.com:agency' } as unknown as NodeJS.ProcessEnv;
    expect(planFor({ email: 'tester@x.com', isOwner: false, subscription: yearly }, overridden).id).toBe('pro');
    expect(planFor({ email: 'tester@x.com', isOwner: false, subscription: null }, overridden).id).toBe('agency');
    expect(planFor({ email: 'o@x.com', isOwner: true, subscription: yearly }, overridden).id).toBe('owner');
  });
});

describe('PLANS', () => {
  it('holds the spec allowances', () => {
    expect(PLANS.free.limits).toEqual({ search: 1, audit: 2, email_lookup: 0 });
    expect(PLANS.pro.limits).toEqual({ search: 25, audit: 250, email_lookup: 100 });
    expect(PLANS.agency.limits).toEqual({ search: 80, audit: 1000, email_lookup: 400 });
    expect([PLANS.pro.monthlyPrice, PLANS.pro.yearlyPrice, PLANS.agency.monthlyPrice, PLANS.agency.yearlyPrice]).toEqual([24, 240, 59, 590]);
    expect(planHas('free', 'auditAll') || planHas('free', 'export')).toBe(false);
    expect(planHas('pro', 'export') && planHas('agency', 'auditAll')).toBe(true);
  });
});

describe('calendarMonth', () => {
  it('is the calendar month in UTC', () => {
    const { start, end } = calendarMonth(new Date('2026-10-31T23:59:59Z'));
    expect(start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
  it('starts a new month at midnight UTC', () =>
    expect(calendarMonth(new Date('2026-11-01T00:00:00Z')).start.toISOString()).toBe('2026-11-01T00:00:00.000Z'));
  it('rolls December into January', () =>
    expect(calendarMonth(new Date('2026-12-15T12:00:00Z')).end.toISOString()).toBe('2027-01-01T00:00:00.000Z'));
});

describe('allowanceWindow', () => {
  const joined = new Date('2026-10-27T15:00:00Z');
  const window = (now: string) => {
    const { start, end } = allowanceWindow(joined, new Date(now));
    return [start.toISOString(), end.toISOString()];
  };
  it('runs 30 days from the moment the account was made', () =>
    expect(window('2026-10-28T09:00:00Z')).toEqual(['2026-10-27T15:00:00.000Z', '2026-11-26T15:00:00.000Z']));
  it('starts the next 30 days the moment one ends', () =>
    expect(window('2026-11-26T15:00:00Z')).toEqual(['2026-11-26T15:00:00.000Z', '2026-12-26T15:00:00.000Z']));
  it('keeps counting in 30s, across months and years', () =>
    expect(window('2027-01-10T00:00:00Z')).toEqual(['2026-12-26T15:00:00.000Z', '2027-01-25T15:00:00.000Z']));
  it('is the first 30 days for a clock a little behind the sign-up', () =>
    expect(window('2026-10-27T14:59:00Z')).toEqual(['2026-10-27T15:00:00.000Z', '2026-11-26T15:00:00.000Z']));
});

describe('usagePeriod', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  it('counts a paid plan from its billing anchor, even with a sign-up date', () =>
    expect(usagePeriod({ isOwner: false, subscription: yearly, joinedAt: '2026-10-27T15:00:00Z' }, now).start.toISOString())
      .toBe('2026-10-14T09:30:00.000Z'));
  it('counts Free in 30 days from sign-up, not to the end of the calendar month', () =>
    expect(usagePeriod({ isOwner: false, subscription: null, joinedAt: '2026-10-27T15:00:00.000Z' }, now).end.toISOString())
      .toBe('2026-11-26T15:00:00.000Z'));
  it('falls back to the calendar month when the sign-up date is unknown or unreadable', () => {
    expect(usagePeriod({ isOwner: false, subscription: null }, now).start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(usagePeriod({ isOwner: false, subscription: null, joinedAt: null }, now).end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(usagePeriod({ isOwner: false, subscription: null, joinedAt: 'soon' }, now).end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('exhausted', () => {
  const summary = (used: number, limit: number | null): UsageSummary => ({
    plan: 'pro', resetsAt: '2026-11-01T00:00:00.000Z',
    usage: { search: { used: 0, limit: 25 }, audit: { used: 0, limit: 250 }, email_lookup: { used, limit } },
  });
  it('names the limit once it is used up', () =>
    expect(exhausted(summary(100, 100), 'email_lookup')).toEqual({ kind: 'email_lookup', plan: 'pro', limit: 100, resetsAt: '2026-11-01T00:00:00.000Z' }));
  it('is null with some left, for unlimited, and for a kind the plan never had', () => {
    expect(exhausted(summary(99, 100), 'email_lookup')).toBeNull();
    expect(exhausted(summary(5, null), 'email_lookup')).toBeNull();
    expect(exhausted(summary(0, 0), 'email_lookup')).toBeNull();
  });
});

describe('readLimit', () => {
  const limit = { kind: 'audit', plan: 'free', limit: 5, resetsAt: '2026-11-01T00:00:00.000Z' };
  it('reads the limit from a 402 body', () => expect(readLimit({ error: 'x', limit })).toEqual(limit));
  it('ignores anything else', () => {
    expect(readLimit({ error: 'x' })).toBeNull();
    expect(readLimit(null)).toBeNull();
    expect(readLimit({ limit: { ...limit, kind: 'pdf' } })).toBeNull();
    expect(readLimit({ limit: { ...limit, limit: '5' } })).toBeNull();
  });
});

describe('per-user settings features', () => {
  it('keeps branding, mailbox and HubSpot for paid plans and the owner', () => {
    for (const f of ['branding', 'mailbox', 'hubspot'] as const) {
      expect(planHas('free', f)).toBe(false);
      expect([planHas('pro', f), planHas('agency', f), planHas('owner', f)]).toEqual([true, true, true]);
    }
  });
});
