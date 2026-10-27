// app/_shared/lib/hooks/useLeadSearch.ts

'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES, ROUTES } from '@/app/_shared/lib/config/routes';
import { startingLeads } from '@/app/_shared/lib/demo/demoSamples';
import { useBusinessList } from '@/app/_shared/lib/hooks/useBusinessList';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { useEmailDiscovery } from '@/app/_shared/lib/hooks/useEmailDiscovery';
import type { UrlAuditRemoval } from '@/app/_shared/lib/hooks/useUrlAudits';
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
  const demo = useDemo();
  // The public demo opens on its sample search
  const { businesses, setBusinesses, mergeContacts, updateBusiness } = useBusinessList(() =>
    demo ? websiteFirst(startingLeads(demo.data)) : []
  );
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!demo);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<SearchQuery | null>(demo?.data.query ?? null);
  // Changes whenever a new result set loads: restarts discovery, resets the list view
  const [runKey, setRunKey] = useState(0);
  const [removal, setRemoval] = useState<UrlAuditRemoval | null>(null);

  const discovery = useEmailDiscovery(businesses, mergeContacts, runKey, !demo);

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
      if (demo) return demo.restrict('search');
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
    [demo, start, show]
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
    if (!searchId || demo) return;
    window.history.replaceState({}, '', ROUTES.HOME);
    openSaved(searchId);
  }, [demo, openSaved]);

  /** The cross on a card: opens the "remove?" dialog for this lead. The demo's samples stay put. */
  const askRemove = useCallback(
    (business: BusinessWithData) => {
      if (!demo) setRemoval({ sites: [business], busy: false, error: null });
    },
    [demo]
  );

  const cancelRemove = useCallback(() => setRemoval(null), []);

  /** The dialog's yes: deletes the lead from its search, with its audit, and takes it off the list */
  const confirmRemove = useCallback(async () => {
    if (!removal || removal.busy) return;
    setRemoval({ ...removal, busy: true, error: null });
    try {
      const res = await fetch(API_ROUTES.RESULTS, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_id: removal.sites[0].search_id, ids: removal.sites.map((site) => site.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRemoval({ ...removal, busy: false, error: data.error ?? "Couldn't remove it. Try again." });
        return;
      }
      const removed = new Set<string>(data.removed ?? []);
      setBusinesses((prev) => prev.filter((b) => !removed.has(b.id)));
      setRemoval(null);
    } catch {
      setRemoval({ ...removal, busy: false, error: "Couldn't reach Auditely. Check your connection and try again." });
    }
  }, [removal, setBusinesses]);

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
    canRemove: !demo,
    removal,
    askRemove,
    cancelRemove,
    confirmRemove,
  };
}
