// app/_shared/lib/hooks/useUrlAudits.ts

'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { useBusinessList } from '@/app/_shared/lib/hooks/useBusinessList';
import { contactsFromResponse } from '@/app/_shared/lib/hooks/useEmailDiscovery';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export interface UrlAuditNotice {
  tone: 'error' | 'info';
  text: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * The "Audit a website" workspace: websites added by URL, newest first.
 * A newly added site is marked to audit as soon as its card appears.
 */
export function useUrlAudits() {
  const { businesses, setBusinesses, mergeContacts, updateBusiness } = useBusinessList();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [notice, setNotice] = useState<UrlAuditNotice | null>(null);
  const [autoRunId, setAutoRunId] = useState<string | null>(null);

  useEffect(() => {
    fetch(API_ROUTES.AUDIT_URL)
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setNotice({ tone: 'error', text: "Couldn't load your earlier audits. Reload the page to try again." }))
      .finally(() => setIsLoading(false));
  }, [setBusinesses]);

  // Contact page and social profiles for a new site; the audit itself finds the email
  const discoverContacts = useCallback(
    (id: string) => {
      fetch(API_ROUTES.FIND_EMAILS, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ business_ids: [id] }) })
        .then((res) => res.json())
        .then((data) => mergeContacts(contactsFromResponse(data)))
        .catch(() => {});
    },
    [mergeContacts]
  );

  /** Adds a website and starts its audit. Resolves true when the form can be cleared. */
  const addWebsite = useCallback(
    async (url: string): Promise<boolean> => {
      setIsAdding(true);
      setNotice(null);
      try {
        const res = await fetch(API_ROUTES.AUDIT_URL, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ url }) });
        const data = await res.json();
        if (!res.ok) {
          setNotice({ tone: 'error', text: data.error ?? "Couldn't add this website. Try again." });
          return false;
        }
        const business: BusinessWithData = data.business;
        setBusinesses((prev) => [business, ...prev.filter((b) => b.id !== business.id)]);
        if (data.existing && business.audit) {
          setNotice({
            tone: 'info',
            text: `${business.name} was audited on ${formatDate(business.audit.created_at)}. Showing that result; use Re-audit for fresh scores.`,
          });
        } else {
          setAutoRunId(business.id);
          if (!business.contacts_checked_at) discoverContacts(business.id);
        }
        return true;
      } catch {
        setNotice({ tone: 'error', text: "Couldn't reach Auditely. Check your connection and try again." });
        return false;
      } finally {
        setIsAdding(false);
      }
    },
    [discoverContacts, setBusinesses]
  );

  return { businesses, isLoading, isAdding, notice, autoRunId, addWebsite, updateBusiness };
}
