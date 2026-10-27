// app/_shared/lib/hooks/useLeadSearch.ts

'use client';

import { useCallback, useRef, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { startingLeads } from '@/app/_shared/lib/demo/demoSamples';
import { useBusinessList } from '@/app/_shared/lib/hooks/useBusinessList';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { useEmailDiscovery } from '@/app/_shared/lib/hooks/useEmailDiscovery';
import { useUsage } from '@/app/_shared/lib/hooks/useUsage';
import { readLimit } from '@/app/_shared/lib/usage/plans';
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
  // Changes whenever a new result set loads: restarts discovery, resets the list view
  const [runKey, setRunKey] = useState(0);
  // The saved search on screen (null: none, or the demo's sample)
  const [searchId, setSearchId] = useState<string | null>(null);
  const [removal, setRemoval] = useState<UrlAuditRemoval | null>(null);
  // Only the latest search or opened search may fill the list: back and forward can overtake one
  const latest = useRef(0);

  const discovery = useEmailDiscovery(businesses, mergeContacts, runKey, !demo);

  const start = useCallback(() => {
    setIsSearching(true);
    setError(null);
    setHasSearched(false);
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
      try {
        const res = await fetch(API_ROUTES.SEARCH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ niche, location }),
        });
        const data = await res.json();
        usage?.refresh();
        if (!res.ok) {
          // Past the plan's searches: the dialog explains it, and the form stays as it was
          const limit = readLimit(data);
          if (limit && usage) {
            if (run === latest.current) usage.promptUpgrade({ limit });
            return;
          }
          throw new Error(data.error ?? 'Search failed');
        }
        if (run !== latest.current) return;
        show(data.businesses ?? [], { niche, location });
        if (typeof data.search_id === 'string') {
          setSearchId(data.search_id);
          onSearched?.(data.search_id);
        }
      } catch (err) {
        if (run === latest.current) setError(err instanceof Error ? err.message : 'Search failed. Check your connection and try again.');
      } finally {
        if (run === latest.current) setIsSearching(false);
      }
    },
    [demo, start, show, onSearched, usage]
  );

  const openSaved = useCallback(
    async (id: string) => {
      const run = start();
      setSearchId(id);
      try {
        const res = await fetch(`${API_ROUTES.RESULTS}?search_id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't open this search");
        if (run !== latest.current) return;
        // A search that was deleted (or never existed) has no record: say so instead of an empty list
        if (!data.search) throw new Error("This search isn't saved any more. Run it again, or open another one.");
        show((data.businesses ?? []).map((b: BusinessRow) => withAuditData(b)), data.search);
      } catch (err) {
        if (run === latest.current) setError(err instanceof Error ? err.message : "Couldn't open this search. Try again.");
      } finally {
        if (run === latest.current) setIsSearching(false);
      }
    },
    [start, show]
  );

  /** Back to the search form and the recent searches (the address went back to /) */
  const reset = useCallback(() => {
    latest.current++;
    setIsSearching(false);
    setError(null);
    setHasSearched(false);
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
    hasSearched,
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
