// app/_shared/lib/utils/savedSearches.ts

// The account's saved searches, for the Saved searches page and the home page's
// recent ones: the list, or why it couldn't be loaded. A failure is never an
// empty list, which would look like no searches at all.

import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { getJson } from '@/app/_shared/lib/utils/jsonRequest';

const LOAD_FAILED = "Couldn't load your saved searches. Try again in a minute.";

export interface SavedSearch {
  id: string;
  niche: string;
  location: string;
  created_at: string;
  business_count: number;
  /** Over 30 days old: Google's details are hidden until it's run again */
  expired?: boolean;
}

export async function loadSavedSearches(): Promise<{ ok: true; searches: SavedSearch[] } | { ok: false; error: string }> {
  const { ok, data } = await getJson(API_ROUTES.SEARCHES);
  const answer = data as { searches?: SavedSearch[]; error?: unknown } | null;
  if (ok && answer) return { ok: true, searches: answer.searches ?? [] };
  return { ok: false, error: typeof answer?.error === 'string' ? answer.error : LOAD_FAILED };
}
