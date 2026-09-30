import { describe, it, expect } from 'vitest';
import { arrangeLeads, averageScore, matchesFilters } from '@/app/_shared/lib/utils/leadView';

type Scores = { performance_score: number | null; seo_score: number | null; mobile_score: number | null; geo_score: number | null; aeo_score: number | null };

const scores = (s: number | null): Scores => ({
  performance_score: s, seo_score: s, mobile_score: s, geo_score: s, aeo_score: s,
});

const lead = (
  name: string,
  fields: { email?: string; phone?: string; website?: string; audit?: Scores; reviews?: number | null } = {}
) => ({
  name,
  email: fields.email ?? null,
  phone: fields.phone ?? null,
  website: fields.website ?? null,
  audit: fields.audit,
  review_count: fields.reviews ?? null,
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

  it('does not mutate the input', () => {
    arrangeLeads(list, 'name', []);
    expect(names(list)).toEqual(['Delta', 'alpha', 'Charlie', 'bravo']);
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
