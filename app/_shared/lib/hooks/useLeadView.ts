// app/_shared/lib/hooks/useLeadView.ts

import { useCallback, useState } from 'react';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';
import {
  arrangeLeads,
  matchesFilters,
  FILTER_OPTIONS,
  type LeadFilter,
  type LeadSort,
} from '@/app/_shared/lib/utils/leadView';

/**
 * Sort + filter state for the results list.
 *
 * The on-screen order is a snapshot, re-arranged only when the sort or filters
 * change or `refreshKey` does (a new search loads, contact discovery finishes).
 * Re-arranging on every data change would make a card jump away — or vanish
 * under an active filter — the moment its email is found. Card data stays live.
 *
 * @param businesses  the full, live result list
 * @param refreshKey  changes whenever the list should be re-arranged
 */
export function useLeadView(businesses: BusinessWithData[], refreshKey: string) {
  const [sort, setSort] = useState<LeadSort>('email');
  const [filters, setFilters] = useState<LeadFilter[]>([]);
  const [snapshot, setSnapshot] = useState({ key: '', ids: [] as string[] });

  // Adjusting state during render (instead of in an effect) avoids a frame in the old order
  const key = `${refreshKey}|${sort}|${filters.join(',')}`;
  if (snapshot.key !== key) {
    setSnapshot({ key, ids: arrangeLeads(businesses, sort, filters).map((b) => b.id) });
  }

  const byId = new Map(businesses.map((b) => [b.id, b]));
  const leads = snapshot.ids.map((id) => byId.get(id)).filter((b): b is BusinessWithData => !!b);

  // Live match count per filter, on top of the filters already active
  const counts = Object.fromEntries(
    FILTER_OPTIONS.map(({ value }) => {
      const combined = filters.includes(value) ? filters : [...filters, value];
      return [value, businesses.filter((b) => matchesFilters(b, combined)).length];
    })
  ) as Record<LeadFilter, number>;

  const toggleFilter = useCallback((filter: LeadFilter) => {
    setFilters((prev) => (prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]));
  }, []);

  const clearFilters = useCallback(() => setFilters([]), []);

  // Exports use the live data, so anything found since the last re-arrange is included
  const currentLeads = useCallback(() => arrangeLeads(businesses, sort, filters), [businesses, sort, filters]);

  return { sort, setSort, filters, toggleFilter, clearFilters, counts, leads, currentLeads };
}
