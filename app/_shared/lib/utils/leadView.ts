// app/_shared/lib/utils/leadView.ts

// Sorting and filtering for the search results list.

import type { Audit, BusinessWithData } from '@/app/_shared/lib/types/auditely';

export type LeadSort = 'email' | 'score' | 'reviews' | 'name' | 'default';
export type LeadFilter = 'email' | 'phone' | 'website' | 'audited';

export type EmailedPreset = 'all' | 'none' | 'any' | 'today' | 'week' | 'month';
/** The first and last day emailed, as a date field gives them (YYYY-MM-DD); '' leaves that side open */
export interface EmailedRange {
  from: string;
  to: string;
}
/** Which leads to keep by their outreach email: everyone, the ones not written to yet, or the ones emailed in a period */
export type EmailedFilter = EmailedPreset | EmailedRange;

type LeadLike = Pick<BusinessWithData, 'name' | 'email' | 'phone' | 'website'> & {
  review_count?: number | null;
  emailed_at?: string | null;
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

export const EMAILED_OPTIONS: { value: EmailedPreset; label: string }[] = [
  { value: 'all', label: 'All leads' },
  { value: 'none', label: 'Not emailed yet' },
  { value: 'any', label: 'Emailed, any time' },
  { value: 'today', label: 'Emailed today' },
  { value: 'week', label: 'Emailed in the last 7 days' },
  { value: 'month', label: 'Emailed in the last 30 days' },
];

// How many days before today each period starts
const DAYS_BACK = { today: 0, week: 6, month: 29 } as const;

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

// YYYY-MM-DD on the viewer's own calendar, the form a date field gives
const localDay = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n) => String(n).padStart(2, '0')).join('-');

/**
 * Whether a business passes the emailed filter. Periods and date ranges go by
 * calendar days, and by the latest email: only that one's date is kept.
 */
export function matchesEmailed(business: Pick<LeadLike, 'emailed_at'>, filter: EmailedFilter, now = new Date()): boolean {
  if (filter === 'all') return true;
  if (filter === 'none') return !business.emailed_at;
  if (!business.emailed_at) return false;
  if (filter === 'any') return true;
  const { from, to } =
    typeof filter === 'string'
      ? { from: localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - DAYS_BACK[filter])), to: '' }
      : filter;
  const day = localDay(new Date(business.emailed_at));
  return (!from || day >= from) && (!to || day <= to);
}

// "Oct 6" for a YYYY-MM-DD day, read and written in UTC so no time zone can shift it
const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** What the emailed filter is showing, for its button */
export function emailedLabel(filter: EmailedFilter): string {
  if (typeof filter === 'string') {
    return (filter !== 'all' && EMAILED_OPTIONS.find((option) => option.value === filter)?.label) || 'Emailed';
  }
  const { from, to } = filter;
  if (from && to) return from === to ? `Emailed ${dayLabel(from)}` : `Emailed ${dayLabel(from)} – ${dayLabel(to)}`;
  if (from) return `Emailed since ${dayLabel(from)}`;
  return to ? `Emailed up to ${dayLabel(to)}` : 'Emailed';
}

/** Whether a business passes every active filter */
export function matchesFilters(business: LeadLike, filters: readonly LeadFilter[], emailed: EmailedFilter = 'all'): boolean {
  return filters.every((f) => MATCHES[f](business)) && matchesEmailed(business, emailed);
}

/**
 * Businesses that pass every active filter, in the chosen order. Sorts are
 * stable, so ties keep the list's own order (website first, then provider rank).
 */
export function arrangeLeads<T extends LeadLike>(
  businesses: T[],
  sort: LeadSort,
  filters: readonly LeadFilter[],
  emailed: EmailedFilter = 'all'
): T[] {
  const kept = businesses.filter((b) => matchesFilters(b, filters, emailed));
  const compare = COMPARE[sort];
  return compare ? kept.sort(compare) : kept;
}
