// app/_shared/lib/hooks/useUrlAudits.ts

'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { useBusinessList } from '@/app/_shared/lib/hooks/useBusinessList';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { contactsFromResponse, type ContactsFound } from '@/app/_shared/lib/hooks/useEmailDiscovery';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';
import { emailFinderNotice } from '@/app/_shared/lib/utils/emailFinderNotice';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Which button's action is running: "Run audit" or "Find email" */
export type UrlAuditBusy = 'audit' | 'email' | null;

/** Sites waiting for a yes in the "remove?" dialog */
export interface UrlAuditRemoval {
  sites: BusinessWithData[];
  busy: boolean;
  error: string | null;
}

export interface UrlAuditNotice {
  tone: 'error' | 'info';
  text: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * The "Audit a website" workspace: websites added by URL, newest first.
 * "Run audit" adds a site and marks it to audit as soon as its card appears;
 * "Find email" adds it without auditing and runs the full email search.
 */
export function useUrlAudits() {
  const demo = useDemo();
  // The public demo lists its sample website and loads nothing
  const { businesses, setBusinesses, mergeContacts, updateBusiness } = useBusinessList(demo?.data.sites);
  const [isLoading, setIsLoading] = useState(!demo);
  const [busy, setBusy] = useState<UrlAuditBusy>(null);
  const [notice, setNotice] = useState<UrlAuditNotice | null>(null);
  const [autoRunId, setAutoRunId] = useState<string | null>(null);
  const [removal, setRemoval] = useState<UrlAuditRemoval | null>(null);

  useEffect(() => {
    if (demo) return;
    fetch(API_ROUTES.AUDIT_URL)
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setNotice({ tone: 'error', text: "Couldn't load your earlier audits. Reload the page to try again." }))
      .finally(() => setIsLoading(false));
  }, [demo, setBusinesses]);

  // One business to /api/find-emails; returns what's now known about it
  const findContacts = useCallback(
    async (id: string, extra: Record<string, unknown> = {}): Promise<ContactsFound | undefined> => {
      const res = await fetch(API_ROUTES.FIND_EMAILS, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ business_ids: [id], ...extra }),
      });
      const found = contactsFromResponse(await res.json());
      mergeContacts(found);
      return found.find((f) => f.id === id);
    },
    [mergeContacts]
  );

  // A new site's contacts: scrape its pages, then — once, like the search tab —
  // Hunter/Snov if there's still no email. (The audit scrapes for email too.)
  const discoverContacts = useCallback(
    async (business: BusinessWithData) => {
      try {
        const scraped = business.contacts_checked_at ? undefined : await findContacts(business.id);
        if (!(scraped?.email ?? business.email) && !business.email_lookup_at) {
          await findContacts(business.id, { apiLookup: 'auto' });
        }
      } catch {
        /* best effort — the card still offers "Find email" */
      }
    },
    [findContacts]
  );

  // Adds the site (or returns it if it's already listed) and puts it at the top
  const addSite = useCallback(
    async (url: string): Promise<{ business: BusinessWithData; existing: boolean } | null> => {
      const res = await fetch(API_ROUTES.AUDIT_URL, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ tone: 'error', text: data.error ?? "Couldn't add this website. Try again." });
        return null;
      }
      const business: BusinessWithData = data.business;
      setBusinesses((prev) => [business, ...prev.filter((b) => b.id !== business.id)]);
      return { business, existing: Boolean(data.existing) };
    },
    [setBusinesses]
  );

  /** "Run audit": adds a website and starts its audit. Resolves true when the form can be cleared. */
  const addWebsite = useCallback(
    async (url: string): Promise<boolean> => {
      if (demo) {
        demo.restrict('auditUrl');
        return false;
      }
      setBusy('audit');
      setNotice(null);
      try {
        const added = await addSite(url);
        if (!added) return false;
        const { business, existing } = added;
        if (existing && business.audit) {
          setNotice({
            tone: 'info',
            text: `${business.name} was audited on ${formatDate(business.audit.created_at)}. Showing that result; use Re-audit for fresh scores.`,
          });
        } else {
          setAutoRunId(business.id);
          void discoverContacts(business);
        }
        return true;
      } catch {
        setNotice({ tone: 'error', text: "Couldn't reach Auditely. Check your connection and try again." });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [addSite, demo, discoverContacts]
  );

  /**
   * "Find email": adds the website without auditing it, then runs the full
   * email search — the site (incl. the deeper crawl), then Hunter and Snov.
   */
  const findEmail = useCallback(
    async (url: string): Promise<boolean> => {
      if (demo) {
        demo.restrict('auditUrl');
        return false;
      }
      setBusy('email');
      setNotice(null);
      try {
        const added = await addSite(url);
        if (!added) return false;
        const found = await findContacts(added.business.id, { apiFallback: true });
        setNotice({ tone: 'info', text: emailFinderNotice(added.business.name, found) });
        return true;
      } catch {
        setNotice({ tone: 'error', text: "Couldn't reach Auditely. Check your connection and try again." });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [addSite, demo, findContacts]
  );

  /** The cross on a card, or "Clear all": opens the "remove?" dialog for these sites */
  const askRemove = useCallback((sites: BusinessWithData[]) => {
    if (sites.length > 0) setRemoval({ sites, busy: false, error: null });
  }, []);

  const cancelRemove = useCallback(() => setRemoval(null), []);

  /** The dialog's yes: deletes the sites with their audits and takes them off the list */
  const confirmRemove = useCallback(async () => {
    if (!removal || removal.busy) return;
    setRemoval({ ...removal, busy: true, error: null });
    try {
      const res = await fetch(API_ROUTES.AUDIT_URL, {
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
      // A note about a site that is gone would only confuse
      setNotice(null);
      setRemoval(null);
    } catch {
      setRemoval({ ...removal, busy: false, error: "Couldn't reach Auditely. Check your connection and try again." });
    }
  }, [removal, setBusinesses]);

  return {
    businesses,
    isLoading,
    busy,
    notice,
    autoRunId,
    addWebsite,
    findEmail,
    updateBusiness,
    removal,
    askRemove,
    cancelRemove,
    confirmRemove,
  };
}
