// app/_shared/lib/places/placeDataErase.ts

// Google's terms keep its place details 30 days (placeData.ts). This blanks them
// on every business older than that: name, address, website, phone, rating,
// review count and business type. Google's place id stays, which it allows, so the business is
// matched again when its search is refreshed, and so do its audit, the contacts
// found on its own website and its CRM state. Websites added by URL and audit
// requests aren't from Google and are left alone. A blanked row has no name,
// which is also how the next run knows to skip it.
//
// It runs for every account, so it uses the service client.

import { serviceDb } from '@/app/_shared/lib/supabase/client';
import { AUDIT_REQUEST_SEARCH } from '@/app/_shared/lib/config/auditRequests';
import { DIRECT_AUDIT_SEARCH } from '@/app/_shared/lib/config/directAudits';
import { placeDataCutoff } from '@/app/_shared/lib/places/placeData';

export const ERASED = { name: '', address: '', website: null, phone: null, rating: null, review_count: null, place_type: null };

// What a database without the place type migration can blank (its write would name a missing column)
const ERASED_WITHOUT_TYPE: Partial<typeof ERASED> = Object.fromEntries(
  Object.entries(ERASED).filter(([column]) => column !== 'place_type')
);

/** Blanks the old details (or, with erase false, only counts them). Returns how many. */
export async function erasePlaceData(erase: boolean, now = new Date()): Promise<{ count: number } | { error: string }> {
  // The searches that hold sites added by URL and audit requests, for every account
  const reserved = await Promise.all(
    [DIRECT_AUDIT_SEARCH, AUDIT_REQUEST_SEARCH].map(({ niche, location }) =>
      serviceDb.from('searches').select('id').eq('niche', niche).eq('location', location)
    )
  );
  const failed = reserved.find((r) => r.error)?.error;
  if (failed) return { error: failed.message };
  const kept = reserved.flatMap((r) => (r.data ?? []).map((s) => s.id as string));

  const run = (fields: Partial<typeof ERASED>) => {
    const businesses = serviceDb.from('businesses');
    let query = (erase ? businesses.update(fields, { count: 'exact' }) : businesses.select('id', { count: 'exact', head: true }))
      .lt('created_at', placeDataCutoff(now))
      .neq('name', '');
    if (kept.length > 0) query = query.not('search_id', 'in', `(${kept.join(',')})`);
    return query;
  };

  let { count, error } = await run(ERASED);
  // Before the place type migration there's no place_type to blank: blank the rest
  if (error?.code === 'PGRST204' && error.message.includes('place_type')) ({ count, error } = await run(ERASED_WITHOUT_TYPE));
  return error ? { error: error.message } : { count: count ?? 0 };
}
