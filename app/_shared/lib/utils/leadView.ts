// app/_shared/lib/utils/leadView.ts

// Sorting and filtering for the search results list.

import type { Audit, BusinessWithData } from '@/app/_shared/lib/types/auditely';

export type LeadSort = 'email' | 'score' | 'reviews' | 'name' | 'default';
export type LeadFilter = 'email' | 'phone' | 'website' | 'audited';

type LeadLike = Pick<BusinessWithData, 'name' | 'email' | 'phone' | 'website'> & {
  review_count?: number | null;
  audit?: Pick<Audit, 'performance_score' | 'seo_score' | 'mobile_score' | 'geo_score' | 'aeo_score' | 'lead_score'>;
};

export const SORT_OPTIONS: { value: LeadSort; label: string }[] = [
  { value: 'email', label: 'Email first' },
  { value: 'score', label: 'Weakest site first' },
  { value: 'reviews', label: 'Fewest reviews first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'default', label: 'Default order' },
];

export const FILTER_OPTIONS: { value: LeadFilter; label: string }[] = [
  { value: 'email', label: 'Has email' },
  { value: 'phone', label: 'Has phone' },
  { value: 'website', label: 'Has website' },
  { value: 'audited', label: 'Audited' },
];

const MATCHES: Record<LeadFilter, (b: LeadLike) => boolean> = {
  email: (b) => !!b.email,
  phone: (b) => !!b.phone,
  website: (b) => !!b.website,
  audited: (b) => !!b.audit,
};

/** Mean of the measured scores; null when the business is unaudited or nothing was measured */
export function averageScore(audit: LeadLike['audit']): number | null {
  if (!audit) return null;
  const scores = [audit.performance_score, audit.seo_score, audit.mobile_score, audit.geo_score, audit.aeo_score, audit.lead_score]
    .filter((s): s is number => typeof s === 'number');
  return scores.length ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null;
}

// Smallest first; unknown (null) values last
function ascendingNullsLast(x: number | null, y: number | null): number {
  if (x === null || y === null) return Number(x === null) - Number(y === null);
  return x - y;
}

const COMPARE: Record<LeadSort, ((a: LeadLike, b: LeadLike) => number) | null> = {
  default: null,
  email: (a, b) => Number(!a.email) - Number(!b.email),
  name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  // Lowest average first (the likeliest prospects); unaudited businesses last
  score: (a, b) => ascendingNullsLast(averageScore(a.audit), averageScore(b.audit)),
  // Few reviews = weak local presence, another sign of a prospect; unknown counts last
  reviews: (a, b) => ascendingNullsLast(a.review_count ?? null, b.review_count ?? null),
};

/** Whether a business passes every active filter */
export function matchesFilters(business: LeadLike, filters: readonly LeadFilter[]): boolean {
  return filters.every((f) => MATCHES[f](business));
}

/**
 * Businesses that pass every active filter, in the chosen order. Sorts are
 * stable, so ties keep the list's own order (website first, then provider rank).
 */
export function arrangeLeads<T extends LeadLike>(businesses: T[], sort: LeadSort, filters: readonly LeadFilter[]): T[] {
  const kept = businesses.filter((b) => matchesFilters(b, filters));
  const compare = COMPARE[sort];
  return compare ? kept.sort(compare) : kept;
}
