// app/_shared/lib/utils/reviewsLabel.ts

/** "4.6 · 123 Google reviews", "No Google reviews", or null when the count is unknown */
export function reviewsLabel(
  rating: number | null | undefined,
  reviewCount: number | null | undefined
): string | null {
  if (reviewCount == null) return null;
  if (reviewCount === 0) return 'No Google reviews';
  const count = `${reviewCount.toLocaleString('en-US')} Google review${reviewCount === 1 ? '' : 's'}`;
  return rating == null ? count : `${rating.toFixed(1)} · ${count}`;
}
