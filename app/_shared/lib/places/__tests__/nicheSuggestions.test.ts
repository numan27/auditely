import { describe, it, expect } from 'vitest';
import { suggestNiches } from '@/app/_shared/lib/places/nicheSuggestions';

describe('suggestNiches', () => {
  it('suggests nothing for an empty input', () => {
    expect(suggestNiches('')).toEqual([]);
    expect(suggestNiches('   ')).toEqual([]);
  });

  it('matches the start of a name, ignoring case', () => {
    expect(suggestNiches('DENT')).toEqual(['Dentists']);
  });

  it('finds agency niches by a later word', () => {
    expect(suggestNiches('agenc')).toEqual([
      'Insurance agencies',
      'Marketing agencies',
      'Digital marketing agencies',
      'SEO agencies',
      'Web design agencies',
      'Advertising agencies',
    ]);
  });

  it('lists names that start with the input before later-word matches', () => {
    expect(suggestNiches('market')).toEqual([
      'Marketing agencies',
      'Digital marketing agencies',
      'Social media marketing agencies',
    ]);
  });

  it('suggests nothing once the input is a whole suggestion', () => {
    expect(suggestNiches('seo agencies')).toEqual([]);
  });

  it('matches word starts, not the middle of a word', () => {
    expect(suggestNiches('gency')).toEqual([]);
  });
});
