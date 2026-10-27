// app/api/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { serviceDb } from '@/app/_shared/lib/supabase/client';
import { searchPlaces } from '@/app/_shared/lib/places/searchPlaces';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const niche: string = (body.niche ?? '').trim().toLowerCase();
  const location: string = (body.location ?? '').trim().toLowerCase();

  if (!niche || !location) {
    return NextResponse.json({ error: 'niche and location are required' }, { status: 400 });
  }

  // Cache check: same niche+location ever searched before
  const { data: existingSearch } = await serviceDb
    .from('searches')
    .select('id')
    .eq('niche', niche)
    .eq('location', location)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSearch) {
    const { data: businesses } = await serviceDb
      .from('businesses')
      .select('*')
      .eq('search_id', existingSearch.id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ search_id: existingSearch.id, businesses: businesses ?? [] });
  }

  // Geoapify in staging, Google Places when PLACES_PROVIDER=google
  const result = await searchPlaces(niche, location);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const allPlaces = result.places;

  // Create search record
  const { data: newSearch, error: searchInsertError } = await serviceDb
    .from('searches')
    .insert({ niche, location })
    .select('id')
    .single();

  if (searchInsertError || !newSearch) {
    return NextResponse.json({ error: 'Failed to create search record' }, { status: 500 });
  }

  // Persist all places in one bulk insert. Rows in one insert share NOW(), so
  // created_at is staggered by 1ms to keep the provider's order for later reads.
  let businesses: unknown[] = [];
  if (allPlaces.length > 0) {
    const insertedAt = Date.now();
    const { data, error: businessInsertError } = await serviceDb
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
      const { error: cleanupError } = await serviceDb.from('searches').delete().eq('id', newSearch.id);
      if (cleanupError) console.error('[search] Failed to remove the empty search:', cleanupError.message);
      return NextResponse.json({ error: 'Failed to store businesses' }, { status: 500 });
    }
    businesses = data ?? [];
  }

  return NextResponse.json({ search_id: newSearch.id, businesses });
}
