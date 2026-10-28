// app/_shared/lib/places/placeStore.ts

// A search's places, saved as its businesses. Google's terms allow its place id
// to be kept for good but the other details for 30 days (placeData.ts), so a
// search run again after that refreshes the rows it has: each place Google sends
// again updates its row, which keeps the lead's audit, contacts and CRM state,
// and the new places are added. The rows Google no longer sends stay as they
// were, hidden as out of date. Until the place-id migration has run, places
// are saved without the id and matched by website, or by name and address.

import type { Db } from '@/app/_shared/lib/supabase/client';
import { placeDataCutoff } from '@/app/_shared/lib/places/placeData';
import { matchPlaces, type SavedPlace } from '@/app/_shared/lib/places/placeMatch';
import type { PlaceResult } from '@/app/_shared/lib/places/types';
import { BUSINESS_WITH_AUDIT } from '@/app/_shared/lib/utils/businessRows';

export const PLACE_DATA_MIGRATION = 'docs/migrations/2026-11-01-place-data.sql';

type DbError = { code?: string; message: string } | null;
type Answer<T> = { data: T | null; error: DbError };

// PostgREST's answers when businesses has no place_id column: a write names it
// (PGRST204), a read selects it (42703)
const missingPlaceId = (error: DbError) =>
  !!error && (error.code === 'PGRST204' || error.code === '42703') && error.message.includes('place_id');

/** Runs a query with place_id, and again without it when the column isn't there yet */
async function withPlaceId<T>(query: (placeIds: boolean) => PromiseLike<Answer<T>>): Promise<Answer<T>> {
  const answer = await query(true);
  if (!missingPlaceId(answer.error)) return answer;
  console.warn(`[places] businesses has no place_id column, so Google's place ids aren't kept. Run ${PLACE_DATA_MIGRATION}.`);
  return query(false);
}

// created_at is staggered by 1ms so the rows read back in Google's order
const at = (start: number, i: number) => new Date(start + i).toISOString();

function row(searchId: string, place: PlaceResult, createdAt: string, placeIds: boolean) {
  return {
    search_id: searchId,
    name: place.name,
    address: place.address,
    website: place.website,
    phone: place.phone,
    rating: place.rating ?? null,
    review_count: place.reviewCount ?? null,
    ...(placeIds ? { place_id: place.placeId ?? null } : {}),
    created_at: createdAt,
  };
}

/** Saves a new search's places as its businesses, in Google's order */
export function insertPlaces(db: Db, searchId: string, places: PlaceResult[], start = Date.now()) {
  return withPlaceId<unknown[]>((placeIds) =>
    db
      .from('businesses')
      .insert(places.map((place, i) => row(searchId, place, at(start, i), placeIds)))
      .select()
  );
}

/** Refreshes a search's businesses from what Google sends now. Returns the error, or null. */
export async function refreshPlaces(db: Db, searchId: string, places: PlaceResult[], start = Date.now()): Promise<string | null> {
  const saved = await withPlaceId<SavedPlace[]>((placeIds) =>
    db
      .from('businesses')
      .select<string, SavedPlace>(placeIds ? 'id, place_id, name, address, website' : 'id, name, address, website')
      .eq('search_id', searchId)
  );
  if (saved.error) return saved.error.message;
  const rows = (saved.data ?? []).map((r) => ({ ...r, place_id: r.place_id ?? null }));

  const { order } = matchPlaces(rows, places);
  const matched = order.flatMap(({ id, place }, i) => (id ? [{ id, place, i }] : []));
  const added = order.flatMap(({ id, place }, i) => (id ? [] : [{ place, i }]));

  if (matched.length > 0) {
    const { error } = await withPlaceId((placeIds) =>
      db
        .from('businesses')
        .upsert(
          matched.map(({ id, place, i }) => ({ id, ...row(searchId, place, at(start, i), placeIds) })),
          { onConflict: 'id' }
        )
    );
    if (error) return error.message;
  }
  if (added.length > 0) {
    const { error } = await withPlaceId((placeIds) =>
      db.from('businesses').insert(added.map(({ place, i }) => row(searchId, place, at(start, i), placeIds)))
    );
    if (error) return error.message;
  }

  // Last, so a refresh that failed part way stays out of date and runs again next time
  const { error } = await db.from('searches').update({ created_at: at(start, 0) }).eq('id', searchId);
  return error ? error.message : null;
}

/** A search's businesses whose place details are under 30 days old, with their audits */
export function freshBusinesses(db: Db, searchId: string, userId: string, now = new Date()) {
  return db
    .from('businesses')
    .select(BUSINESS_WITH_AUDIT)
    .eq('search_id', searchId)
    // A second lock: Row Level Security already shows only this account's businesses
    .eq('user_id', userId)
    .gte('created_at', placeDataCutoff(now))
    .order('created_at', { ascending: true })
    // Newest first, so the client's audits[0] / ai_reports[0] is the latest even with duplicates
    .order('created_at', { referencedTable: 'audits', ascending: false })
    .order('created_at', { referencedTable: 'audits.ai_reports', ascending: false });
}
