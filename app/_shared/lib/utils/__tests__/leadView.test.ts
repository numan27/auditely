import { describe, it, expect } from 'vitest';
import { arrangeLeads, averageScore, emailedLabel, matchesEmailed, matchesFilters } from '@/app/_shared/lib/utils/leadView';

type Scores = { performance_score: number | null; seo_score: number | null; mobile_score: number | null; geo_score: number | null; aeo_score: number | null };

const scores = (s: number | null): Scores => ({
  performance_score: s, seo_score: s, mobile_score: s, geo_score: s, aeo_score: s,
});

const lead = (
  name: string,
  fields: { email?: string; phone?: string; website?: string; audit?: Scores; reviews?: number | null; emailedAt?: string } = {}
) => ({
  name,
  email: fields.email ?? null,
  phone: fields.phone ?? null,
  website: fields.website ?? null,
  audit: fields.audit,
  review_count: fields.reviews ?? null,
  emailed_at: fields.emailedAt ?? null,
});

const names = (list: { name: string }[]) => list.map((b) => b.name);

describe('arrangeLeads', () => {
  const list = [
    lead('Delta', { website: 'd.com' }),
    lead('alpha', { website: 'a.com', email: 'a@a.com', phone: '1' }),
    lead('Charlie'),
    lead('bravo', { website: 'b.com', email: 'b@b.com' }),
  ];

  it('email first puts businesses without an email at the bottom, keeping the order within each group', () => {
    expect(names(arrangeLeads(list, 'email', []))).toEqual(['alpha', 'bravo', 'Delta', 'Charlie']);
  });

  it('default keeps the list order', () => {
    expect(names(arrangeLeads(list, 'default', []))).toEqual(['Delta', 'alpha', 'Charlie', 'bravo']);
  });

  it('sorts by name case-insensitively', () => {
    expect(names(arrangeLeads(list, 'name', []))).toEqual(['alpha', 'bravo', 'Charlie', 'Delta']);
  });

  it('weakest site first ranks by average score and puts unaudited businesses last', () => {
    const audited = [
      lead('unaudited'),
      lead('strong', { audit: scores(90) }),
      lead('weak', { audit: scores(30) }),
      lead('unmeasured', { audit: scores(null) }),
    ];
    expect(names(arrangeLeads(audited, 'score', []))).toEqual(['weak', 'strong', 'unaudited', 'unmeasured']);
  });

  it('fewest reviews first ranks by Google review count and puts unknown counts last', () => {
    const reviewed = [
      lead('unknown'),
      lead('popular', { reviews: 480 }),
      lead('none', { reviews: 0 }),
      lead('few', { reviews: 7 }),
    ];
    expect(names(arrangeLeads(reviewed, 'reviews', []))).toEqual(['none', 'few', 'popular', 'unknown']);
  });

  it('keeps only businesses that pass every active filter', () => {
    expect(names(arrangeLeads(list, 'default', ['website']))).toEqual(['Delta', 'alpha', 'bravo']);
    expect(names(arrangeLeads(list, 'default', ['email', 'phone']))).toEqual(['alpha']);
  });

  it('applies the emailed filter on top of the others', () => {
    const outreach = [
      lead('written', { email: 'w@w.com', emailedAt: '2026-10-03T10:00:00.000Z' }),
      lead('waiting', { email: 'x@x.com' }),
      lead('no address'),
    ];
    expect(names(arrangeLeads(outreach, 'default', [], 'any'))).toEqual(['written']);
    expect(names(arrangeLeads(outreach, 'default', [], 'none'))).toEqual(['waiting', 'no address']);
    expect(names(arrangeLeads(outreach, 'default', ['email'], 'none'))).toEqual(['waiting']);
  });

  it('does not mutate the input', () => {
    arrangeLeads(list, 'name', []);
    expect(names(list)).toEqual(['Delta', 'alpha', 'Charlie', 'bravo']);
  });
});

describe('matchesEmailed', () => {
  // Tuesday 6 October 2026, 3 pm, wherever the tests run
  const now = new Date(2026, 9, 6, 15);
  const emailedOn = (month: number, day: number, hour: number) => ({
    emailed_at: new Date(2026, month - 1, day, hour).toISOString(),
  });
  const neverEmailed = { emailed_at: null };

  it('"all" keeps every lead, emailed or not', () => {
    expect(matchesEmailed(emailedOn(10, 3, 12), 'all', now)).toBe(true);
    expect(matchesEmailed(neverEmailed, 'all', now)).toBe(true);
  });

  it('"none" keeps only the leads never emailed', () => {
    expect(matchesEmailed(neverEmailed, 'none', now)).toBe(true);
    expect(matchesEmailed(emailedOn(10, 3, 12), 'none', now)).toBe(false);
  });

  it('"none" keeps a lead read before the emailed-at migration', () => {
    expect(matchesEmailed({}, 'none', now)).toBe(true);
  });

  it('"any" keeps a lead however long ago it was emailed', () => {
    expect(matchesEmailed(emailedOn(1, 2, 12), 'any', now)).toBe(true);
    expect(matchesEmailed(neverEmailed, 'any', now)).toBe(false);
  });

  it('"today" goes by the calendar day, not the last 24 hours', () => {
    expect(matchesEmailed(emailedOn(10, 6, 0), 'today', now)).toBe(true);
    expect(matchesEmailed(emailedOn(10, 5, 23), 'today', now)).toBe(false);
  });

  it('"week" covers today and the six days before it', () => {
    expect(matchesEmailed(emailedOn(9, 30, 0), 'week', now)).toBe(true);
    expect(matchesEmailed(emailedOn(9, 29, 23), 'week', now)).toBe(false);
  });

  it('"month" covers today and the 29 days before it', () => {
    expect(matchesEmailed(emailedOn(9, 7, 0), 'month', now)).toBe(true);
    expect(matchesEmailed(emailedOn(9, 6, 23), 'month', now)).toBe(false);
  });

  it('a date range includes both of its end days', () => {
    const range = { from: '2026-10-01', to: '2026-10-03' };
    expect(matchesEmailed(emailedOn(9, 30, 23), range, now)).toBe(false);
    expect(matchesEmailed(emailedOn(10, 1, 0), range, now)).toBe(true);
    expect(matchesEmailed(emailedOn(10, 3, 23), range, now)).toBe(true);
    expect(matchesEmailed(emailedOn(10, 4, 0), range, now)).toBe(false);
  });

  it('a date range with one end left empty is open on that side', () => {
    expect(matchesEmailed(emailedOn(1, 2, 12), { from: '', to: '2026-10-03' }, now)).toBe(true);
    expect(matchesEmailed(emailedOn(10, 4, 0), { from: '', to: '2026-10-03' }, now)).toBe(false);
    expect(matchesEmailed(emailedOn(10, 6, 12), { from: '2026-10-01', to: '' }, now)).toBe(true);
    expect(matchesEmailed(emailedOn(9, 30, 23), { from: '2026-10-01', to: '' }, now)).toBe(false);
  });

  it('no period or date range matches a lead that was never emailed', () => {
    expect(matchesEmailed(neverEmailed, 'today', now)).toBe(false);
    expect(matchesEmailed(neverEmailed, 'month', now)).toBe(false);
    expect(matchesEmailed(neverEmailed, { from: '', to: '' }, now)).toBe(false);
  });
});

describe('emailedLabel', () => {
  it('names a date range by its two days', () => {
    expect(emailedLabel({ from: '2026-10-01', to: '2026-10-06' })).toBe('Emailed Oct 1 – Oct 6');
  });

  it('names a single day once', () => {
    expect(emailedLabel({ from: '2026-10-01', to: '2026-10-01' })).toBe('Emailed Oct 1');
  });

  it('says which side an open range is open on', () => {
    expect(emailedLabel({ from: '2026-10-01', to: '' })).toBe('Emailed since Oct 1');
    expect(emailedLabel({ from: '', to: '2026-10-06' })).toBe('Emailed up to Oct 6');
  });

  it('reads as the plain filter name while every lead is shown', () => {
    expect(emailedLabel('all')).toBe('Emailed');
  });

  it('uses the menu wording for a chosen period', () => {
    expect(emailedLabel('none')).toBe('Not emailed yet');
    expect(emailedLabel('week')).toBe('Emailed in the last 7 days');
  });
});

describe('matchesFilters', () => {
  it('treats an audit as the audited filter', () => {
    expect(matchesFilters(lead('x', { audit: scores(50) }), ['audited'])).toBe(true);
    expect(matchesFilters(lead('x'), ['audited'])).toBe(false);
  });

  it('passes everything when no filter is active', () => {
    expect(matchesFilters(lead('x'), [])).toBe(true);
  });
});

describe('averageScore', () => {
  it('includes the lead capture score when measured', () => {
    expect(averageScore({ ...scores(null), performance_score: 40, lead_score: 100 })).toBe(70);
  });

  it('averages only the measured scores', () => {
    expect(averageScore({ ...scores(null), performance_score: 40, seo_score: 80 })).toBe(60);
  });

  it('is null when unaudited or nothing was measured', () => {
    expect(averageScore(undefined)).toBeNull();
    expect(averageScore(scores(null))).toBeNull();
  });
});
