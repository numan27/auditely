import { describe, it, expect } from 'vitest';
import {
  ANY_PLACE,
  UNKNOWN_TYPE,
  matchesPlace,
  placeFilterLabel,
  placeTypes,
  sizeBucket,
  sizeHint,
} from '@/app/_shared/lib/utils/placeFilter';

describe('sizeBucket', () => {
  it('reads the size from the review count', () => {
    expect(sizeBucket(0)).toBe('small');
    expect(sizeBucket(24)).toBe('small');
    expect(sizeBucket(25)).toBe('medium');
    expect(sizeBucket(99)).toBe('medium');
    expect(sizeBucket(100)).toBe('large');
  });

  it('has no size for an unknown count', () => {
    expect(sizeBucket(null)).toBeNull();
    expect(sizeBucket(undefined)).toBeNull();
    expect(sizeHint(null)).toBeNull();
  });

  it('words the hint for the card', () => {
    expect(sizeHint(3)).toBe('Likely small');
    expect(sizeHint(250)).toBe('Likely large');
  });
});

describe('matchesPlace', () => {
  const agency = { place_type: 'Marketing agency', review_count: 12 };
  const staffing = { place_type: 'Employment agency', review_count: 300 };
  const untyped = { place_type: null, review_count: null };

  it('keeps everything with no choice made', () => {
    expect([agency, staffing, untyped].every((b) => matchesPlace(b, ANY_PLACE))).toBe(true);
  });

  it('keeps only the chosen types, with unknown types as a type of their own', () => {
    expect(matchesPlace(agency, { types: ['Marketing agency'], size: 'all' })).toBe(true);
    expect(matchesPlace(staffing, { types: ['Marketing agency'], size: 'all' })).toBe(false);
    expect(matchesPlace(untyped, { types: [UNKNOWN_TYPE], size: 'all' })).toBe(true);
  });

  it('keeps only the chosen size, leaving out unknown review counts', () => {
    expect(matchesPlace(agency, { types: [], size: 'small' })).toBe(true);
    expect(matchesPlace(staffing, { types: [], size: 'small' })).toBe(false);
    expect(matchesPlace(untyped, { types: [], size: 'small' })).toBe(false);
  });

  it('needs both the type and the size to match', () => {
    expect(matchesPlace(agency, { types: ['Marketing agency'], size: 'large' })).toBe(false);
  });
});

describe('placeTypes', () => {
  it('counts each type, most common first, then by name', () => {
    const types = placeTypes([
      { place_type: 'Marketing agency' },
      { place_type: 'Employment agency' },
      { place_type: 'Marketing agency' },
      { place_type: null },
    ]);
    expect(types).toEqual([
      { type: 'Marketing agency', count: 2 },
      { type: 'Employment agency', count: 1 },
      { type: UNKNOWN_TYPE, count: 1 },
    ]);
  });
});

describe('placeFilterLabel', () => {
  it('names what the filter is showing', () => {
    expect(placeFilterLabel(ANY_PLACE)).toBe('Type & size');
    expect(placeFilterLabel({ types: ['Marketing agency'], size: 'all' })).toBe('Marketing agency');
    expect(placeFilterLabel({ types: ['A', 'B', 'C'], size: 'small' })).toBe('3 types · Small');
    expect(placeFilterLabel({ types: [], size: 'large' })).toBe('Large');
  });
});
