import { describe, it, expect } from 'vitest';
import { dayKey, dayKeyLabel, knownTimeZone, requestDueDay, requestDueKey, requestDueToday, requestStatus } from '@/app/_shared/lib/utils/requestDue';

// Local times, as the viewer's calendar counts them. Oct 27, 2026 is a Tuesday.
const at = (day: number, hour = 10) => new Date(2026, 9, day, hour).toISOString();
const dayOf = (date: Date) => [date.getMonth() + 1, date.getDate()];

describe('requestDueDay', () => {
  it('is the next day on a weekday', () => {
    expect(dayOf(requestDueDay(at(27)))).toEqual([10, 28]);
    expect(dayOf(requestDueDay(at(27, 23)))).toEqual([10, 28]);
  });

  it('skips the weekend: a Friday, Saturday or Sunday request is due Monday', () => {
    expect(dayOf(requestDueDay(at(30)))).toEqual([11, 2]);
    expect(dayOf(requestDueDay(at(31)))).toEqual([11, 2]);
    expect(dayOf(requestDueDay(new Date(2026, 10, 1, 10).toISOString()))).toEqual([11, 2]);
  });
});

describe('requestStatus', () => {
  it('says when it was replied to, whatever the due day', () => {
    expect(requestStatus(at(20), at(28), new Date(2026, 9, 29))).toEqual({ state: 'replied', label: 'Replied Oct 28' });
  });

  it('counts down to the due day', () => {
    expect(requestStatus(at(27), null, new Date(2026, 9, 27, 12))).toEqual({ state: 'due', label: 'Reply by Wed, Oct 28' });
    expect(requestStatus(at(27), null, new Date(2026, 9, 28, 17))).toEqual({ state: 'due', label: 'Reply today' });
  });

  it('is overdue once the due day has passed', () => {
    expect(requestStatus(at(27), undefined, new Date(2026, 9, 29, 8))).toEqual({ state: 'overdue', label: 'Overdue: due Wed, Oct 28' });
  });
});

describe('on a named time zone', () => {
  it('counts the day the request came in on that calendar', () => {
    // 03:00 UTC Wednesday is still Tuesday evening in New York
    expect(dayKey(new Date('2026-10-28T03:00:00Z'), 'America/New_York')).toBe('2026-10-27');
    expect(dayKey(new Date('2026-10-28T03:00:00Z'), 'UTC')).toBe('2026-10-28');
    expect(requestDueKey('2026-10-28T03:00:00Z', 'America/New_York')).toBe('2026-10-28');
    expect(requestDueKey('2026-10-28T03:00:00Z', 'UTC')).toBe('2026-10-29');
  });

  it('skips the weekend', () => {
    expect(requestDueKey('2026-10-30T15:00:00Z', 'UTC')).toBe('2026-11-02');
    expect(requestDueKey('2026-11-01T15:00:00Z', 'UTC')).toBe('2026-11-02');
  });

  it('is due on the due day and overdue after it', () => {
    const requested = '2026-10-27T15:00:00Z';
    expect(requestDueToday(requested, new Date('2026-10-27T20:00:00Z'), 'UTC')).toBeNull();
    expect(requestDueToday(requested, new Date('2026-10-28T09:00:00Z'), 'UTC')).toBe('due');
    expect(requestDueToday(requested, new Date('2026-10-29T00:30:00Z'), 'UTC')).toBe('overdue');
    // Still Wednesday in Los Angeles
    expect(requestDueToday(requested, new Date('2026-10-29T00:30:00Z'), 'America/Los_Angeles')).toBe('due');
  });

  it('labels a day key', () => {
    expect(dayKeyLabel('2026-10-28')).toBe('Wed, Oct 28');
  });

  it('only takes time zones it knows', () => {
    expect(knownTimeZone('Asia/Karachi')).toBe('Asia/Karachi');
    expect(knownTimeZone('Mars/Olympus')).toBeUndefined();
    expect(knownTimeZone('')).toBeUndefined();
    expect(knownTimeZone(null)).toBeUndefined();
  });
});
