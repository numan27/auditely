// app/api/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import type { Db } from '@/app/_shared/lib/supabase/client';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { placeDataFresh } from '@/app/_shared/lib/places/placeData';
import { freshBusinesses, insertPlaces, refreshPlaces } from '@/app/_shared/lib/places/placeStore';
import { searchPlaces } from '@/app/_shared/lib/places/searchPlaces';
import { meterFor, refusal } from '@/app/_shared/lib/usage/usage';

// A saved search is reused while its place details are under 30 days old (Google's
// terms limit how long they may be kept), then refreshed from Google: the leads
// Google sends again keep their audits (placeStore.ts)

const NOT_SAVED = "Couldn't save the search. Try again in a minute.";
const NOT_OPENED = "Couldn't open this search. Try again in a minute.";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db, account } = session;

  const body = await request.json().catch(() => ({}));
  const niche: string = (body.niche ?? '').trim().toLowerCase();
  const location: string = (body.location ?? '').trim().toLowerCase();

  if (!niche || !location) {
    return NextResponse.json({ error: 'Enter a type of business and a city.' }, { status: 400 });
  }

  // The same niche and city searched before by this account. The user_id filter is
  // a second lock: Row Level Security already shows only their own searches.
  const { data: earlier } = await db
    .from('searches')
    .select('id, created_at')
    .eq('user_id', account.id)
    .eq('niche', niche)
    .eq('location', location)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Reused while it's fresh, which costs nothing
  if (earlier && placeDataFresh(earlier.created_at)) return savedSearch(db, earlier.id, account.id);

  // A new search counts against the plan, and so does refreshing an old one. It's
  // given back when nothing gets saved, and when it finds no places: an empty search
  // shouldn't use up a Free account's one. The meter caps how many come back in a
  // day, since the provider bills each.
  const claim = await meterFor(account).claim('search');
  if (!claim.ok) return refusal(claim);

  // Geoapify in staging, Google Places when PLACES_PROVIDER=google
  const result = await searchPlaces(niche, location);
  if (!result.ok) {
    await claim.release();
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const allPlaces = result.places;

  if (earlier) {
    // Nothing found now: the old leads stay as they were, out of date
    if (allPlaces.length === 0) {
      await claim.release();
      return NextResponse.json({ search_id: earlier.id, businesses: [] });
    }
    const failed = await refreshPlaces(db, earlier.id, allPlaces);
    if (failed) {
      console.error('[search] Failed to refresh the search:', failed);
      await claim.release();
      return NextResponse.json({ error: NOT_SAVED }, { status: 500 });
    }
    return savedSearch(db, earlier.id, account.id);
  }

  // Create search record
  const { data: newSearch, error: searchInsertError } = await db
    .from('searches')
    .insert({ niche, location })
    .select('id')
    .single();

  if (searchInsertError || !newSearch) {
    console.error('[search] Failed to save the search:', searchInsertError?.message);
    await claim.release();
    return NextResponse.json({ error: NOT_SAVED }, { status: 500 });
  }

  // Persist all places in one bulk insert, in the provider's order
  let businesses: unknown[] = [];
  if (allPlaces.length > 0) {
    const { data, error: businessInsertError } = await insertPlaces(db, newSearch.id, allPlaces);

    if (businessInsertError) {
      console.error('[search] Failed to store businesses:', businessInsertError.message);
      // Drop the empty search, or the next identical search would reuse it and find nothing
      const { error: cleanupError } = await db.from('searches').delete().eq('id', newSearch.id);
      if (cleanupError) console.error('[search] Failed to remove the empty search:', cleanupError.message);
      await claim.release();
      return NextResponse.json({ error: NOT_SAVED }, { status: 500 });
    }
    businesses = data ?? [];
  } else {
    await claim.release();
  }

  return NextResponse.json({ search_id: newSearch.id, businesses });
}

/** A saved search's leads, with their audits, as Saved searches opens it */
async function savedSearch(db: Db, searchId: string, userId: string) {
  const { data, error } = await freshBusinesses(db, searchId, userId);
  if (error) {
    // It's saved and fresh, so trying again reuses it at no cost
    console.error('[search] Failed to load the saved search:', error.message);
    return NextResponse.json({ error: NOT_OPENED }, { status: 500 });
  }
  return NextResponse.json({ search_id: searchId, businesses: data ?? [] });
}
