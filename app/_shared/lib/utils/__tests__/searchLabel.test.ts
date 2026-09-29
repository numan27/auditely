import { describe, it, expect } from 'vitest';
import { formatPlace, searchTitle } from '@/app/_shared/lib/utils/searchLabel';

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
