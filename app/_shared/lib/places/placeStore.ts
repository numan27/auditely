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
export const PLACE_TYPE_MIGRATION = 'docs/migrations/2026-11-04-place-type.sql';

type DbError = { code?: string; message: string } | null;
type Answer<T> = { data: T | null; error: DbError };

// Columns that come with a migration a database may not have run yet, and what's lost without each
const OPTIONAL_COLUMNS = {
  place_id: { migration: PLACE_DATA_MIGRATION, lost: "Google's place ids aren't kept" },
  place_type: { migration: PLACE_TYPE_MIGRATION, lost: 'business types (Marketing agency, Dentist…) aren\'t kept' },
} as const;
type OptionalColumn = keyof typeof OPTIONAL_COLUMNS;
type Columns = ReadonlySet<OptionalColumn>;

// PostgREST's answers when businesses lacks a column: a write names it (PGRST204), a read selects it (42703)
function missingColumn(error: DbError): OptionalColumn | null {
  if (!error || (error.code !== 'PGRST204' && error.code !== '42703')) return null;
  return (Object.keys(OPTIONAL_COLUMNS) as OptionalColumn[]).find((column) => error.message.includes(column)) ?? null;
}

/** Runs a query with every optional column, and again without each one the database doesn't have yet */
async function withOptionalColumns<T>(query: (columns: Columns) => PromiseLike<Answer<T>>): Promise<Answer<T>> {
  const columns = new Set(Object.keys(OPTIONAL_COLUMNS) as OptionalColumn[]);
  for (;;) {
    const answer = await query(columns);
    const missing = missingColumn(answer.error);
    if (!missing || !columns.has(missing)) return answer;
    const { migration, lost } = OPTIONAL_COLUMNS[missing];
    console.warn(`[places] businesses has no ${missing} column, so ${lost}. Run ${migration}.`);
    columns.delete(missing);
  }
}

// created_at is staggered by 1ms so the rows read back in Google's order
const at = (start: number, i: number) => new Date(start + i).toISOString();

function row(searchId: string, place: PlaceResult, createdAt: string, columns: Columns) {
  return {
    search_id: searchId,
    name: place.name,
    address: place.address,
    website: place.website,
    phone: place.phone,
    rating: place.rating ?? null,
    review_count: place.reviewCount ?? null,
    ...(columns.has('place_id') ? { place_id: place.placeId ?? null } : {}),
    ...(columns.has('place_type') ? { place_type: place.placeType ?? null } : {}),
    created_at: createdAt,
  };
}

/** Saves a new search's places as its businesses, in Google's order */
export function insertPlaces(db: Db, searchId: string, places: PlaceResult[], start = Date.now()) {
  return withOptionalColumns<unknown[]>((columns) =>
    db
      .from('businesses')
      .insert(places.map((place, i) => row(searchId, place, at(start, i), columns)))
      .select()
  );
}

/** Refreshes a search's businesses from what Google sends now. Returns the error, or null. */
export async function refreshPlaces(db: Db, searchId: string, places: PlaceResult[], start = Date.now()): Promise<string | null> {
  const saved = await withOptionalColumns<SavedPlace[]>((columns) =>
    db
      .from('businesses')
      .select<string, SavedPlace>(columns.has('place_id') ? 'id, place_id, name, address, website' : 'id, name, address, website')
      .eq('search_id', searchId)
  );
  if (saved.error) return saved.error.message;
  const rows = (saved.data ?? []).map((r) => ({ ...r, place_id: r.place_id ?? null }));

  const { order } = matchPlaces(rows, places);
  const matched = order.flatMap(({ id, place }, i) => (id ? [{ id, place, i }] : []));
  const added = order.flatMap(({ id, place }, i) => (id ? [] : [{ place, i }]));

  if (matched.length > 0) {
    const { error } = await withOptionalColumns((columns) =>
      db
        .from('businesses')
        .upsert(
          matched.map(({ id, place, i }) => ({ id, ...row(searchId, place, at(start, i), columns) })),
          { onConflict: 'id' }
        )
    );
    if (error) return error.message;
  }
  if (added.length > 0) {
    const { error } = await withOptionalColumns((columns) =>
      db.from('businesses').insert(added.map(({ place, i }) => row(searchId, place, at(start, i), columns)))
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
