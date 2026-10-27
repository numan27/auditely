// app/_shared/lib/hooks/useAuditRequests.ts

'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { useBusinessList } from '@/app/_shared/lib/hooks/useBusinessList';
import type { UrlAuditRemoval } from '@/app/_shared/lib/hooks/useUrlAudits';
import { REQUESTS_CHANGED_EVENT } from '@/app/_shared/lib/notifications/notificationTypes';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const UNREACHABLE = "Couldn't reach Auditely. Check your connection and try again.";

/**
 * The Requests tab: free audits requested on devartventures.com, newest
 * first. They arrive audited (or being audited) by the server; "Refresh"
 * picks up new ones and the audits finished since the list loaded, and so
 * does the header bell when it hears of a new request or a finished audit.
 */
export function useAuditRequests() {
  const { businesses, setBusinesses, updateBusiness } = useBusinessList();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removal, setRemoval] = useState<UrlAuditRemoval | null>(null);
  // Cards remount on a refresh, so they pick up the audits the server finished since
  const [loadKey, setLoadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.AUDIT_REQUESTS);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBusinesses(data.businesses ?? []);
      setLoadKey((key) => key + 1);
      setError(null);
    } catch {
      setError("Couldn't load the audit requests. Try Refresh, or reload the page.");
    }
  }, [setBusinesses]);

  useEffect(() => {
    void load().finally(() => setIsLoading(false));
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    const reload = () => void refresh();
    window.addEventListener(REQUESTS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(REQUESTS_CHANGED_EVENT, reload);
  }, [refresh]);

  /** The cross on a card, or "Clear all": opens the "remove?" dialog for these requests */
  const askRemove = useCallback((sites: BusinessWithData[]) => {
    if (sites.length > 0) setRemoval({ sites, busy: false, error: null });
  }, []);

  const cancelRemove = useCallback(() => setRemoval(null), []);

  /** The dialog's yes: deletes the requests with their audits and takes them off the list */
  const confirmRemove = useCallback(async () => {
    if (!removal || removal.busy) return;
    setRemoval({ ...removal, busy: true, error: null });
    try {
      const res = await fetch(API_ROUTES.AUDIT_REQUESTS, {
        method: 'DELETE',
        headers: JSON_HEADERS,
        body: JSON.stringify({ ids: removal.sites.map((site) => site.id) }),
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
      setRemoval({ ...removal, busy: false, error: UNREACHABLE });
    }
  }, [removal, setBusinesses]);

  return { businesses, isLoading, refreshing, error, loadKey, refresh, updateBusiness, removal, askRemove, cancelRemove, confirmRemove };
}
