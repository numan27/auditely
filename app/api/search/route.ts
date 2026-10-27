// app/api/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { searchPlaces } from '@/app/_shared/lib/places/searchPlaces';
import { meterFor, refusal } from '@/app/_shared/lib/usage/usage';

// A saved search is reused for this long, then searched afresh: Google's terms
// limit how long place details may be kept
const SEARCH_REUSE_DAYS = 30;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db, account } = session;

  const body = await request.json().catch(() => ({}));
  const niche: string = (body.niche ?? '').trim().toLowerCase();
  const location: string = (body.location ?? '').trim().toLowerCase();

  if (!niche || !location) {
    return NextResponse.json({ error: 'niche and location are required' }, { status: 400 });
  }

  // Cache check: same niche+location searched recently by this account. A reused
  // search costs nothing. The user_id filter is a second lock: Row Level Security
  // already shows only their own searches.
  const reuseSince = new Date(Date.now() - SEARCH_REUSE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: existingSearch } = await db
    .from('searches')
    .select('id')
    .eq('user_id', account.id)
    .eq('niche', niche)
    .eq('location', location)
    .gte('created_at', reuseSince)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSearch) {
    const { data: businesses } = await db
      .from('businesses')
      .select('*')
      .eq('search_id', existingSearch.id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ search_id: existingSearch.id, businesses: businesses ?? [] });
  }

  // A new search counts against the plan. It's given back when nothing gets saved;
  // one that finds no places still counts, because the provider billed it.
  const claim = await meterFor(account).claim('search');
  if (!claim.ok) return refusal(claim);

  // Geoapify in staging, Google Places when PLACES_PROVIDER=google
  const result = await searchPlaces(niche, location);
  if (!result.ok) {
    await claim.release();
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const allPlaces = result.places;

  // Create search record
  const { data: newSearch, error: searchInsertError } = await db
    .from('searches')
    .insert({ niche, location })
    .select('id')
    .single();

  if (searchInsertError || !newSearch) {
    await claim.release();
    return NextResponse.json({ error: 'Failed to create search record' }, { status: 500 });
  }

  // Persist all places in one bulk insert. Rows in one insert share NOW(), so
  // created_at is staggered by 1ms to keep the provider's order for later reads.
  let businesses: unknown[] = [];
  if (allPlaces.length > 0) {
    const insertedAt = Date.now();
    const { data, error: businessInsertError } = await db
      .from('businesses')
      .insert(
        allPlaces.map((place, i) => ({
          search_id: newSearch.id,
          name: place.name,
          address: place.address,
          website: place.website,
          phone: place.phone,
          rating: place.rating ?? null,
          review_count: place.reviewCount ?? null,
          created_at: new Date(insertedAt + i).toISOString(),
        }))
      )
      .select();

    if (businessInsertError) {
      console.error('[search] Failed to store businesses:', businessInsertError.message);
      // Drop the empty search, or the next identical search would reuse it and find nothing
      const { error: cleanupError } = await db.from('searches').delete().eq('id', newSearch.id);
      if (cleanupError) console.error('[search] Failed to remove the empty search:', cleanupError.message);
      await claim.release();
      return NextResponse.json({ error: 'Failed to store businesses' }, { status: 500 });
    }
    businesses = data ?? [];
  }

  return NextResponse.json({ search_id: newSearch.id, businesses });
}
