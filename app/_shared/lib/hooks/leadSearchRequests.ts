// app/_shared/lib/hooks/leadSearchRequests.ts

// The two requests behind "Find leads": a new search and a saved one. Whatever
// comes back, the page gets the results or a sentence it can show: the server's
// own reason, or a plain one when there was no answer or it wasn't readable.

import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { SearchQuery } from '@/app/_shared/lib/hooks/useLeadSearch';
import { readLimit, type LimitReached } from '@/app/_shared/lib/usage/plans';
import { withAuditData, type BusinessRow } from '@/app/_shared/lib/utils/businessRows';
import { getJson, postJson } from '@/app/_shared/lib/utils/jsonRequest';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

const SEARCH_FAILED = "The search didn't finish. Try again in a minute.";
const OPEN_FAILED = "Couldn't open this search. Try again in a minute.";
const GONE = "This search isn't saved any more. Run it again, or open another one.";

type Failure = { ok: false; error: string };

const reason = (data: unknown, fallback: string): string => {
  const error = (data as { error?: unknown } | null)?.error;
  return typeof error === 'string' ? error : fallback;
};

export type SearchAnswer =
  | { ok: true; businesses: BusinessWithData[]; searchId: string | null }
  | (Failure & { limit: LimitReached | null });

export async function requestSearch(niche: string, location: string): Promise<SearchAnswer> {
  const { ok, data } = await postJson(API_ROUTES.SEARCH, { niche, location });
  if (!ok || !data) return { ok: false, error: reason(data, SEARCH_FAILED), limit: readLimit(data) };
  // A saved search reused or refreshed comes back with its audits embedded
  const found = data as { businesses?: BusinessRow[]; search_id?: unknown };
  return {
    ok: true,
    businesses: (found.businesses ?? []).map((b) => withAuditData(b)),
    searchId: typeof found.search_id === 'string' ? found.search_id : null,
  };
}

/** A search over 30 days old: Google's details for its leads are hidden until it's run again */
export type ExpiredSearch = { count: number };

export type SavedAnswer =
  | { ok: true; businesses: BusinessWithData[]; search: SearchQuery; expired: ExpiredSearch | null }
  | Failure;

export async function requestSaved(id: string): Promise<SavedAnswer> {
  const { ok, data } = await getJson(`${API_ROUTES.RESULTS}?search_id=${encodeURIComponent(id)}`);
  if (!ok || !data) return { ok: false, error: reason(data, OPEN_FAILED) };
  const saved = data as { search?: SearchQuery | null; businesses?: BusinessRow[]; expired?: ExpiredSearch };
  // A search that was deleted (or never existed) has no record: say so instead of an empty list
  if (!saved.search) return { ok: false, error: GONE };
  return {
    ok: true,
    businesses: (saved.businesses ?? []).map((b) => withAuditData(b)),
    search: saved.search,
    expired: typeof saved.expired?.count === 'number' ? { count: saved.expired.count } : null,
  };
}
