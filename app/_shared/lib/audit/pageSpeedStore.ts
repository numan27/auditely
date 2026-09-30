// app/_shared/lib/audit/pageSpeedStore.ts

// The shared PageSpeed cache, stored in Supabase's `pagespeed_cache` table
// (docs/migrations/2026-09-30-pagespeed-cache-and-ratings.sql). Server-only.

import { supabase } from '@/app/_shared/lib/supabase/client';
import type { PageSpeedStore } from '@/app/_shared/lib/audit/pageSpeedCache';

export const pageSpeedStore: PageSpeedStore = {
  async get(urlKey, strategy) {
    const { data, error } = await supabase
      .from('pagespeed_cache')
      .select('summary, is_on_https, engine_version, fetched_at')
      .eq('url_key', urlKey)
      .eq('strategy', strategy)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      summary: data.summary,
      isOnHttps: data.is_on_https,
      engineVersion: data.engine_version,
      fetchedAt: data.fetched_at,
    };
  },

  async put(urlKey, strategy, entry) {
    // Upserts on the primary key (url_key, strategy)
    const { error } = await supabase.from('pagespeed_cache').upsert({
      url_key: urlKey,
      strategy,
      summary: entry.summary,
      is_on_https: entry.isOnHttps,
      engine_version: entry.engineVersion,
      fetched_at: entry.fetchedAt,
    });
    if (error) throw new Error(error.message);
  },
};
