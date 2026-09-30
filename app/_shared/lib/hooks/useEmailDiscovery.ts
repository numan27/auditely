// app/_shared/lib/hooks/useEmailDiscovery.ts

import { useEffect, useEffectEvent, useState } from 'react';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';
import type { Socials } from '@/app/_shared/lib/utils/contactChannels';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

const CHUNK_SIZE = 8;

export interface DiscoveryProgress {
  done: number;
  total: number;
}

export interface ContactsFound {
  id: string;
  email: string | null;
  phone: string | null;
  contact_page: string | null;
  socials: Socials;
}

// No email yet, or contact channels never checked (searches from before they existed)
function pendingIds(businesses: BusinessWithData[]): string[] {
  return businesses.filter((b) => b.website && (!b.email || !b.contacts_checked_at)).map((b) => b.id);
}

/** Businesses the paid-API email lookup should still run for: once each, after scraping. */
export function emailLookupCandidates(businesses: BusinessWithData[], foundEmail: Set<string>): string[] {
  return businesses
    .filter((b) => b.website && !b.email && !b.email_lookup_at && !foundEmail.has(b.id))
    .map((b) => b.id);
}

const initialTotal = (businesses: BusinessWithData[]) =>
  pendingIds(businesses).length + emailLookupCandidates(businesses, new Set()).length;

/** Maps a /api/find-emails response to the contacts found per business */
export function contactsFromResponse(data: { results?: FindResultDto[] }): ContactsFound[] {
  return (data.results ?? []).map((r) => ({
    id: r.business_id,
    email: r.email,
    phone: r.phone,
    contact_page: r.contact_page,
    socials: r.socials ?? {},
  }));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Background contact discovery (email, phone, contact page, social profiles)
 * for a freshly loaded search, in two passes:
 *   1. Scrape every business's website (free).
 *   2. For those still without an email, the paid email APIs — once per
 *      business ever (email_lookup_at), and in 'auto' mode: Hunter then Snov,
 *      each spending a credit only when its free count says it has an email.
 * Businesses are processed in sequential chunks so each request stays well
 * under serverless time limits, and discovered contacts are merged into the
 * list as each chunk returns.
 *
 * @param businesses      current business list (read via an effect event — merging
 *                         contacts back in does NOT restart discovery)
 * @param onContactsFound called per chunk with each business's current contacts
 * @param runKey          changes when a new search loads; restarts discovery
 */
export function useEmailDiscovery(
  businesses: BusinessWithData[],
  onContactsFound: (found: ContactsFound[]) => void,
  runKey: string | number
): DiscoveryProgress {
  const [progress, setProgress] = useState(() => ({
    runKey,
    done: 0,
    total: initialTotal(businesses),
  }));

  // A new run resets progress. Adjusting state during render (instead of in the
  // effect) avoids an extra cascading render.
  if (progress.runKey !== runKey) {
    setProgress({ runKey, done: 0, total: initialTotal(businesses) });
  }

  // Effect events always see the latest props without being effect dependencies
  const onFound = useEffectEvent(onContactsFound);
  const getPendingIds = useEffectEvent(() => pendingIds(businesses));
  const getLookupIds = useEffectEvent((foundEmail: Set<string>) => emailLookupCandidates(businesses, foundEmail));

  useEffect(() => {
    const pending = getPendingIds();
    const lookupAtStart = getLookupIds(new Set());
    if (pending.length === 0 && lookupAtStart.length === 0) return;

    let cancelled = false;
    const controller = new AbortController();
    const foundEmail = new Set<string>();

    // One chunk to /api/find-emails; false once the run was cancelled
    const post = async (ids: string[], extra: Record<string, unknown>): Promise<boolean> => {
      try {
        const res = await fetch(API_ROUTES.FIND_EMAILS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ business_ids: ids, ...extra }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (cancelled) return false;
        const found = contactsFromResponse(data);
        found.forEach((f) => f.email && foundEmail.add(f.id));
        if (found.length) onFound(found);
      } catch {
        /* chunk failed (e.g. aborted) — continue with the rest */
      }
      return !cancelled;
    };

    (async () => {
      let done = 0;
      let total = pending.length + lookupAtStart.length;

      // 1. Scrape (free)
      for (const ids of chunk(pending, CHUNK_SIZE)) {
        if (!(await post(ids, {}))) return;
        done += ids.length;
        setProgress({ runKey, done, total });
      }

      // 2. Paid APIs once, for those scraping didn't find an email for
      const lookup = getLookupIds(foundEmail);
      total = done + lookup.length;
      setProgress({ runKey, done, total });
      for (const ids of chunk(lookup, CHUNK_SIZE)) {
        if (!(await post(ids, { apiLookup: 'auto' }))) return;
        done += ids.length;
        setProgress({ runKey, done, total });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // Keyed only on runKey: a new search restarts discovery. `businesses` and
    // the callback are read via effect events, so merging found emails does not re-run.
  }, [runKey]);

  return { done: progress.done, total: progress.total };
}

interface FindResultDto {
  business_id: string;
  email: string | null;
  phone: string | null;
  contact_page: string | null;
  socials: Socials | null;
}
