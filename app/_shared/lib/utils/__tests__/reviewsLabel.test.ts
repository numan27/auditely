import { describe, it, expect } from 'vitest';
import { reviewsLabel } from '@/app/_shared/lib/utils/reviewsLabel';

describe('reviewsLabel', () => {
  it('shows the rating with the review count', () => {
    expect(reviewsLabel(4.6, 123)).toBe('4.6 · 123 Google reviews');
    expect(reviewsLabel(4.2, 1234)).toBe('4.2 · 1,234 Google reviews');
    expect(reviewsLabel(5, 1)).toBe('5.0 · 1 Google review');
  });

  it('says so when the business has no reviews yet', () => {
    expect(reviewsLabel(null, 0)).toBe('No Google reviews');
  });

  it('shows nothing when the count is unknown', () => {
    expect(reviewsLabel(null, null)).toBeNull();
    // Rows read before the rating columns existed
    expect(reviewsLabel(undefined, undefined)).toBeNull();
  });
});
