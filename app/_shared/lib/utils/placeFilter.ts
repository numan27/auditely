// app/_shared/lib/utils/placeFilter.ts

// The results' Type & size filter: Google's business type, and a rough size read
// from the Google review count. Google doesn't say how many people a business
// employs, so the size is a hint, not a headcount.

export type SizeBucket = 'small' | 'medium' | 'large';
export type SizeFilter = 'all' | SizeBucket;

export interface PlaceFilter {
  /** Business types to keep; empty keeps every type */
  types: string[];
  size: SizeFilter;
}

export const ANY_PLACE: PlaceFilter = { types: [], size: 'all' };

/** The type shown for a business Google gave no type for (older searches, other providers) */
export const UNKNOWN_TYPE = 'Type unknown';

// Review counts where a business moves up a size
const MEDIUM_FROM = 25;
const LARGE_FROM = 100;

export const SIZE_OPTIONS: { value: SizeFilter; label: string }[] = [
  { value: 'all', label: 'Any size' },
  { value: 'small', label: `Small: under ${MEDIUM_FROM} reviews` },
  { value: 'medium', label: `Medium: ${MEDIUM_FROM}–${LARGE_FROM - 1} reviews` },
  { value: 'large', label: `Large: ${LARGE_FROM}+ reviews` },
];

const SIZE_HINTS: Record<SizeBucket, string> = {
  small: 'Likely small',
  medium: 'Likely mid-size',
  large: 'Likely large',
};

type PlaceLike = { place_type?: string | null; review_count?: number | null };

/** The size a business's review count suggests; null when the count is unknown */
export function sizeBucket(reviewCount: number | null | undefined): SizeBucket | null {
  if (reviewCount == null) return null;
  if (reviewCount >= LARGE_FROM) return 'large';
  return reviewCount >= MEDIUM_FROM ? 'medium' : 'small';
}

/** "Likely small" and so on for the card, or null when the review count is unknown */
export function sizeHint(reviewCount: number | null | undefined): string | null {
  const bucket = sizeBucket(reviewCount);
  return bucket ? SIZE_HINTS[bucket] : null;
}

export const typeOf = (business: PlaceLike): string => business.place_type || UNKNOWN_TYPE;

/** Whether a business passes the Type & size filter. A size choice leaves out unknown review counts. */
export function matchesPlace(business: PlaceLike, filter: PlaceFilter): boolean {
  if (filter.types.length > 0 && !filter.types.includes(typeOf(business))) return false;
  return filter.size === 'all' || sizeBucket(business.review_count) === filter.size;
}

/** The types in a result list with how many businesses have each, most common first */
export function placeTypes(businesses: readonly PlaceLike[]): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const business of businesses) counts.set(typeOf(business), (counts.get(typeOf(business)) ?? 0) + 1);
  return [...counts]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

export const isPlaceFiltered = (filter: PlaceFilter) => filter.types.length > 0 || filter.size !== 'all';

/** What the filter is showing, for its chip: "Type & size", "Marketing agency", "3 types · Small" */
export function placeFilterLabel(filter: PlaceFilter): string {
  const parts: string[] = [];
  if (filter.types.length === 1) parts.push(filter.types[0]);
  else if (filter.types.length > 1) parts.push(`${filter.types.length} types`);
  if (filter.size !== 'all') parts.push(filter.size[0].toUpperCase() + filter.size.slice(1));
  return parts.length > 0 ? parts.join(' · ') : 'Type & size';
}
