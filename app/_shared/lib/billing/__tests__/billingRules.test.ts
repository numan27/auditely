import { describe, it, expect } from 'vitest';
import {
  INTERVALS,
  PAID_PLANS,
  fromLookupKey,
  isLive,
  isLiveStatus,
  lookupKey,
  monthlyWindow,
} from '@/app/_shared/lib/billing/billingRules';

const iso = (d: { start: Date; end: Date }) => [d.start.toISOString(), d.end.toISOString()];
const at = (s: string) => new Date(s);

describe('monthlyWindow', () => {
  it('steps whole months from the anchor, keeping its day and time, clamped to short months', () => {
    const a = at('2026-01-31T10:00:00Z');
    expect(iso(monthlyWindow(a, at('2026-02-15T00:00:00Z')))).toEqual(['2026-01-31T10:00:00.000Z', '2026-02-28T10:00:00.000Z']);
    expect(iso(monthlyWindow(a, at('2026-03-01T00:00:00Z')))).toEqual(['2026-02-28T10:00:00.000Z', '2026-03-31T10:00:00.000Z']);
    expect(iso(monthlyWindow(a, at('2026-04-30T10:00:00Z')))).toEqual(['2026-04-30T10:00:00.000Z', '2026-05-31T10:00:00.000Z']);
  });

  it('gives a yearly plan the month it is in', () => {
    expect(iso(monthlyWindow(at('2026-03-14T09:30:00Z'), at('2026-10-27T12:00:00Z')))).toEqual([
      '2026-10-14T09:30:00.000Z',
      '2026-11-14T09:30:00.000Z',
    ]);
  });

  it('takes the day from the anchor, not from the month before', () => {
    expect(iso(monthlyWindow(at('2024-02-29T00:00:00Z'), at('2025-03-10T00:00:00Z')))).toEqual([
      '2025-02-28T00:00:00.000Z',
      '2025-03-29T00:00:00.000Z',
    ]);
  });

  it('counts back when now is before the anchor', () => {
    expect(iso(monthlyWindow(at('2026-11-14T09:30:00Z'), at('2026-11-01T00:00:00Z')))).toEqual([
      '2026-10-14T09:30:00.000Z',
      '2026-11-14T09:30:00.000Z',
    ]);
  });
});

describe('isLive', () => {
  const now = at('2026-10-27T12:00:00Z');
  const sub = (status: string, periodEnd = '2026-11-14T00:00:00Z') => ({ status, periodEnd });

  it('keeps active, trialing and past_due subscriptions', () => {
    expect(['active', 'trialing', 'past_due'].map((s) => isLive(sub(s), now))).toEqual([true, true, true]);
  });

  it('drops ended ones', () => {
    expect(['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'].map((s) => isLive(sub(s), now))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('allows three days past the period end for a late renewal', () => {
    expect(isLive(sub('active', '2026-10-25T12:00:00Z'), now)).toBe(true);
    expect(isLive(sub('active', '2026-10-24T11:00:00Z'), now)).toBe(false);
  });

  it('tells a live status from an ended one, whatever the dates', () => {
    expect(['active', 'past_due', 'canceled'].map(isLiveStatus)).toEqual([true, true, false]);
  });
});

describe('lookup keys', () => {
  it('round-trips every plan and interval, and rejects others', () => {
    expect(lookupKey('agency', 'year')).toBe('auditely_agency_yearly');
    for (const plan of PAID_PLANS) {
      for (const interval of INTERVALS) expect(fromLookupKey(lookupKey(plan, interval))).toEqual({ plan, interval });
    }
    expect([fromLookupKey('auditely_owner_monthly'), fromLookupKey('other'), fromLookupKey(null)]).toEqual([null, null, null]);
  });
});
