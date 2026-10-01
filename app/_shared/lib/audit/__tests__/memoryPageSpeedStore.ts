import type { CachedPageSpeed, PageSpeedStore } from '@/app/_shared/lib/audit/pageSpeedCache';

/** In-memory stand-in for the pagespeed_cache table, keyed `${url_key}|${strategy}` like its primary key */
export function memoryPageSpeedStore(initial: Record<string, CachedPageSpeed> = {}) {
  const rows = new Map(Object.entries(initial));
  const store: PageSpeedStore = {
    get: async (urlKey, strategy) => rows.get(`${urlKey}|${strategy}`) ?? null,
    put: async (urlKey, strategy, value) => {
      rows.set(`${urlKey}|${strategy}`, value);
    },
  };
  return { store, rows };
}
