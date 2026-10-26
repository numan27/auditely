import { describe, it, expect } from 'vitest';
import { requestDueDay, requestStatus } from '@/app/_shared/lib/utils/requestDue';

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
