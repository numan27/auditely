// app/_shared/lib/hooks/useEmailDiscovery.ts

import { useEffect, useEffectEvent, useState } from 'react';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';
import type { Socials } from '@/app/_shared/lib/utils/contactChannels';

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Background contact discovery (email, phone, contact page, social profiles)
 * for a freshly loaded search.
 *
 * Scrape-only (no API fallback) so it can run automatically across every
 * business without burning quota. Businesses are processed in sequential
 * chunks so each request stays well under serverless time limits, and
 * discovered contacts are merged into the list as each chunk returns.
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
    total: pendingIds(businesses).length,
  }));

  // A new run resets progress. Adjusting state during render (instead of in the
  // effect) avoids an extra cascading render.
  if (progress.runKey !== runKey) {
    setProgress({ runKey, done: 0, total: pendingIds(businesses).length });
  }

  // Effect events always see the latest props without being effect dependencies
  const onFound = useEffectEvent(onContactsFound);
  const getPendingIds = useEffectEvent(() => pendingIds(businesses));

  useEffect(() => {
    const pending = getPendingIds();
    if (pending.length === 0) return;

    let cancelled = false;
    const controller = new AbortController();
    const chunks = chunk(pending, CHUNK_SIZE);

    (async () => {
      let done = 0;
      for (const ids of chunks) {
        if (cancelled) return;
        try {
          const res = await fetch('/api/find-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ business_ids: ids }),
            signal: controller.signal,
          });
          const data = await res.json();
          if (cancelled) return;
          const found: ContactsFound[] = (data.results ?? []).map((r: FindResultDto) => ({
            id: r.business_id,
            email: r.email,
            phone: r.phone,
            contact_page: r.contact_page,
            socials: r.socials ?? {},
          }));
          if (found.length) onFound(found);
        } catch {
          /* chunk failed (e.g. aborted) — continue with the rest */
        }
        done += ids.length;
        if (!cancelled) setProgress({ runKey, done, total: pending.length });
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
