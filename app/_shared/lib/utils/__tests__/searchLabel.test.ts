import { describe, it, expect } from 'vitest';
import { formatPlace, searchCount, searchTitle } from '@/app/_shared/lib/utils/searchLabel';

describe('formatPlace', () => {
  it('title-cases the city and upper-cases short region codes', () => {
    expect(formatPlace('las vegas, nv, usa')).toBe('Las Vegas, NV, USA');
  });

  it('title-cases longer parts', () => {
    expect(formatPlace('texas city, texas')).toBe('Texas City, Texas');
    expect(formatPlace('miami')).toBe('Miami');
  });
});

describe('searchTitle', () => {
  it('joins the niche and place', () => {
    expect(searchTitle({ niche: 'driving school', location: 'new york' })).toBe('Driving school in New York');
  });
});

describe('searchCount', () => {
  it('counts the businesses', () => {
    expect(searchCount({ business_count: 4, expired: false })).toBe('4 businesses');
    expect(searchCount({ business_count: 1, expired: false })).toBe('1 business');
  });

  // Google's terms keep its place details 30 days: opening the search offers to run it again
  it('says when a search is over 30 days old', () => {
    expect(searchCount({ business_count: 5, expired: true })).toBe('5 businesses · over 30 days old');
  });
});
