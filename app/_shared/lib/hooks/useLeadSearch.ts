// app/_shared/lib/hooks/useLeadSearch.ts

'use client';

import { useCallback, useRef, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { startingLeads } from '@/app/_shared/lib/demo/demoSamples';
import { useBusinessList } from '@/app/_shared/lib/hooks/useBusinessList';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { useEmailDiscovery } from '@/app/_shared/lib/hooks/useEmailDiscovery';
import { useUsage } from '@/app/_shared/lib/hooks/useUsage';
import { requestSaved, requestSearch, type ExpiredSearch } from '@/app/_shared/lib/hooks/leadSearchRequests';
import type { UrlAuditRemoval } from '@/app/_shared/lib/hooks/useUrlAudits';
import { websiteFirst } from '@/app/_shared/lib/utils/businessOrder';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

export interface SearchQuery {
  niche: string;
  location: string;
}

/**
 * The "Find leads" workspace: runs a search or opens a saved one, then
 * discovers contacts for the results in the background. The address
 * (/search/{id}) is the workspace's business: `onSearched` reports each new
 * search's id, and `openSaved` / `reset` follow the address back.
 */
export function useLeadSearch({ onSearched }: { onSearched?: (searchId: string) => void } = {}) {
  const demo = useDemo();
  const usage = useUsage();
  // The public demo opens on its sample search
  const { businesses, setBusinesses, mergeContacts, updateBusiness } = useBusinessList(() =>
    demo ? websiteFirst(startingLeads(demo.data)) : []
  );
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!demo);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<SearchQuery | null>(demo?.data.query ?? null);
  // The new search running now (null while a saved one opens): the radar names it
  const [pending, setPending] = useState<SearchQuery | null>(null);
  // Changes whenever a new result set loads: restarts discovery, resets the list view
  const [runKey, setRunKey] = useState(0);
  // The saved search on screen (null: none, or the demo's sample)
  const [searchId, setSearchId] = useState<string | null>(null);
  const [removal, setRemoval] = useState<UrlAuditRemoval | null>(null);
  // The saved search on screen is over 30 days old: its leads wait for it to run again
  const [expired, setExpired] = useState<ExpiredSearch | null>(null);
  // Only the latest search or opened search may fill the list: back and forward can overtake one
  const latest = useRef(0);

  const discovery = useEmailDiscovery(businesses, mergeContacts, runKey, !demo);

  const start = useCallback(() => {
    setIsSearching(true);
    setPending(null);
    setError(null);
    setHasSearched(false);
    setExpired(null);
    setBusinesses([]);
    return ++latest.current;
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
      const run = start();
      setPending({ niche, location });
      const result = await requestSearch(niche, location);
      usage?.refresh();
      if (run !== latest.current) return;
      setIsSearching(false);
      setPending(null);
      if (!result.ok) {
        // Past the plan's searches: the dialog explains it, and the form stays as it was
        if (result.limit && usage) return usage.promptUpgrade({ limit: result.limit });
        return setError(result.error);
      }
      show(result.businesses, { niche, location });
      if (result.searchId) {
        setSearchId(result.searchId);
        onSearched?.(result.searchId);
      }
    },
    [demo, start, show, onSearched, usage]
  );

  const openSaved = useCallback(
    async (id: string) => {
      const run = start();
      setSearchId(id);
      const result = await requestSaved(id);
      if (run !== latest.current) return;
      setIsSearching(false);
      if (!result.ok) return setError(result.error);
      show(result.businesses, result.search);
      setExpired(result.expired);
    },
    [start, show]
  );

  /** Back to the search form and the recent searches (the address went back to /) */
  const reset = useCallback(() => {
    latest.current++;
    setIsSearching(false);
    setPending(null);
    setError(null);
    setHasSearched(false);
    setExpired(null);
    setBusinesses([]);
    setQuery(null);
    setSearchId(null);
    setRemoval(null);
  }, [setBusinesses]);

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
    pending,
    hasSearched,
    expired,
    error,
    query,
    runKey,
    searchId,
    discovery,
    search,
    openSaved,
    reset,
    updateBusiness,
    canRemove: !demo,
    removal,
    askRemove,
    cancelRemove,
    confirmRemove,
  };
}
