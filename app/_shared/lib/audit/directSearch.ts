// app/_shared/lib/audit/directSearch.ts

import type { Db } from '@/app/_shared/lib/supabase/client';
import { DIRECT_AUDIT_SEARCH } from '@/app/_shared/lib/config/directAudits';

// This account's reserved search. The user_id filter is a second lock: Row Level
// Security already shows only its own searches.
export async function directSearchId(db: Db, userId: string): Promise<string | null> {
  const { data } = await db
    .from('searches')
    .select('id')
    .eq('user_id', userId)
    .eq('niche', DIRECT_AUDIT_SEARCH.niche)
    .eq('location', DIRECT_AUDIT_SEARCH.location)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
