// app/_shared/lib/hooks/useBusinessList.ts

import { useCallback, useState } from 'react';
import type { BusinessUpdate, BusinessWithData } from '@/app/_shared/lib/types/auditely';
import type { ContactsFound } from '@/app/_shared/lib/hooks/useEmailDiscovery';

/**
 * A list of businesses that contact discovery and the cards write back into.
 * @param initial what the list starts with (the public demo's sample)
 */
export function useBusinessList(initial: BusinessWithData[] | (() => BusinessWithData[]) = []) {
  const [businesses, setBusinesses] = useState<BusinessWithData[]>(initial);

  // Merge discovered contacts into the list (cards re-render via prop sync)
  const mergeContacts = useCallback((found: ContactsFound[]) => {
    setBusinesses((prev) =>
      prev.map((b) => {
        const hit = found.find((f) => f.id === b.id);
        if (!hit) return b;
        return {
          ...b,
          email: hit.email ?? b.email,
          phone: hit.phone ?? b.phone,
          contact_page: hit.contact_page,
          socials: hit.socials,
        };
      })
    );
  }, []);

  // Emails, audits and reports produced inside a card, so sorting and export see them
  const updateBusiness = useCallback((id: string, update: BusinessUpdate) => {
    setBusinesses((prev) => prev.map((b) => (b.id === id ? { ...b, ...update } : b)));
  }, []);

  return { businesses, setBusinesses, mergeContacts, updateBusiness };
}
