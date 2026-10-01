// app/_shared/lib/audit/pageSpeedCache.ts

// PageSpeed results shared by every listing of the same website for 30 days:
// the same site found by two searches ("dentist", "dental clinic") is only
// speed-tested once. Only PageSpeed is shared — the page checks compare the
// site against each listing's own name, address and phone, so they always run.

import { websiteKey } from '@/app/_shared/lib/utils/websiteUrl';
import { CURRENT_ENGINE_VERSION, type LighthouseSummary } from '@/app/_shared/lib/audit/types';
import type { runPageSpeed, PageSpeedStrategy } from '@/app/_shared/lib/audit/pageSpeed';

export const PAGESPEED_CACHE_DAYS = 30;
const DAY_MS = 86_400_000;

export interface CachedPageSpeed {
  summary: LighthouseSummary;
  isOnHttps: boolean | null;
  engineVersion: number;
  fetchedAt: string;
}

export interface PageSpeedStore {
  get(urlKey: string, strategy: PageSpeedStrategy): Promise<CachedPageSpeed | null>;
  put(urlKey: string, strategy: PageSpeedStrategy, entry: CachedPageSpeed): Promise<void>;
}

interface CacheOptions {
  /** Re-audit: skip the stored result and replace it with a fresh run */
  refresh?: boolean;
  now?: () => number;
}

/**
 * Wraps runPageSpeed with the shared cache. The cache is only an optimization:
 * if it can't be read or written the audit still runs PageSpeed. Failed runs
 * are never stored, so the next audit tries again.
 */
export function withPageSpeedCache(
  run: typeof runPageSpeed,
  store: PageSpeedStore,
  { refresh = false, now = Date.now }: CacheOptions = {}
): typeof runPageSpeed {
  return async (website, strategy, deadline) => {
    const key = websiteKey(website);

    if (!refresh) {
      const cached = await store.get(key, strategy).catch((err) => {
        console.warn('[pagespeed-cache] read failed:', err instanceof Error ? err.message : err);
        return null;
      });
      const age = cached ? now() - Date.parse(cached.fetchedAt) : Infinity;
      if (cached && cached.engineVersion === CURRENT_ENGINE_VERSION && age <= PAGESPEED_CACHE_DAYS * DAY_MS) {
        return { ok: true, summary: cached.summary, isOnHttps: cached.isOnHttps, measuredAt: cached.fetchedAt };
      }
    }

    const result = await run(website, strategy, deadline);
    if (result.ok) {
      const entry: CachedPageSpeed = {
        summary: result.summary,
        isOnHttps: result.isOnHttps,
        engineVersion: CURRENT_ENGINE_VERSION,
        fetchedAt: new Date(now()).toISOString(),
      };
      await store.put(key, strategy, entry).catch((err) => {
        console.warn('[pagespeed-cache] write failed:', err instanceof Error ? err.message : err);
      });
    }
    return result;
  };
}
