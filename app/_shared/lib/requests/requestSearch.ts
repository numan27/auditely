// app/_shared/lib/requests/requestSearch.ts

// The reserved search that holds the audits requested on devartventures.com
// (config/auditRequests.ts), one per owner: a user's own search with the same
// name is never theirs to read. Server-only.

import type { Db } from '@/app/_shared/lib/supabase/client';
import { AUDIT_REQUEST_SEARCH } from '@/app/_shared/lib/config/auditRequests';

/** Every search row with the reserved name, oldest first: two first requests at once could each create one */
export async function requestSearchIds(db: Db, ownerId: string): Promise<string[]> {
  const { data } = await db
    .from('searches')
    .select('id')
    .eq('user_id', ownerId)
    .eq('niche', AUDIT_REQUEST_SEARCH.niche)
    .eq('location', AUDIT_REQUEST_SEARCH.location)
    .order('created_at', { ascending: true });
  return (data ?? []).map((row) => row.id as string);
}

/** The search new requests go into, created with the first request; null when it can't be */
export async function ensureRequestSearchId(db: Db, ownerId: string): Promise<string | null> {
  const [first] = await requestSearchIds(db, ownerId);
  if (first) return first;
  const { data, error } = await db.from('searches').insert({ ...AUDIT_REQUEST_SEARCH, user_id: ownerId }).select('id').single();
  if (error || !data) {
    console.error('[audit-requests] Failed to create the requests search:', error?.message);
    return null;
  }
  return data.id as string;
}
