// app/_shared/lib/hooks/useLeadSearch.ts

'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES, ROUTES } from '@/app/_shared/lib/config/routes';
import { useBusinessList } from '@/app/_shared/lib/hooks/useBusinessList';
import { useEmailDiscovery } from '@/app/_shared/lib/hooks/useEmailDiscovery';
import { websiteFirst } from '@/app/_shared/lib/utils/businessOrder';
import { withAuditData, type BusinessRow } from '@/app/_shared/lib/utils/businessRows';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

export interface SearchQuery {
  niche: string;
  location: string;
}

/**
 * The "Find leads" workspace: runs a search or opens a saved one, then
 * discovers contacts for the results in the background.
 */
export function useLeadSearch() {
  const { businesses, setBusinesses, mergeContacts, updateBusiness } = useBusinessList();
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<SearchQuery | null>(null);
  // Changes whenever a new result set loads: restarts discovery, resets the list view
  const [runKey, setRunKey] = useState(0);

  const discovery = useEmailDiscovery(businesses, mergeContacts, runKey);

  const start = useCallback(() => {
    setIsSearching(true);
    setError(null);
    setHasSearched(false);
    setBusinesses([]);
  }, [setBusinesses]);

  const show = useCallback(
    (list: BusinessWithData[], nextQuery: SearchQuery | null) => {
      setBusinesses(websiteFirst(list));
      setQuery(nextQuery);
      setHasSearched(true);
      setRunKey((n) => n + 1);
    },
    [setBusinesses]
  );

  const search = useCallback(
    async (niche: string, location: string) => {
      start();
      try {
        const res = await fetch(API_ROUTES.SEARCH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ niche, location }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Search failed');
        show(data.businesses ?? [], { niche, location });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed. Check your connection and try again.');
      } finally {
        setIsSearching(false);
      }
    },
    [start, show]
  );

  const openSaved = useCallback(
    async (searchId: string) => {
      start();
      try {
        const res = await fetch(`${API_ROUTES.RESULTS}?search_id=${encodeURIComponent(searchId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't open this search");
        show((data.businesses ?? []).map((b: BusinessRow) => withAuditData(b)), data.search ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't open this search. Try again.");
      } finally {
        setIsSearching(false);
      }
    },
    [start, show]
  );

  // Opened from Saved Searches (?load=<search_id>)
  useEffect(() => {
    const searchId = new URLSearchParams(window.location.search).get('load');
    if (!searchId) return;
    window.history.replaceState({}, '', ROUTES.HOME);
    openSaved(searchId);
  }, [openSaved]);

  return {
    businesses,
    isSearching,
    hasSearched,
    error,
    query,
    runKey,
    discovery,
    search,
    openSaved,
    updateBusiness,
  };
}
