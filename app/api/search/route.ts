// app/api/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';

// 5 geographic sub-queries to work around Google Places' 20-result-per-query cap.
// Deduplication by place_id gives up to ~100 unique results per search.
function buildSubQueries(niche: string, location: string): string[] {
  return [
    `${niche} in ${location}`,
    `${niche} in north ${location}`,
    `${niche} in south ${location}`,
    `${niche} in east ${location}`,
    `${niche} in west ${location}`,
  ];
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const niche: string = (body.niche ?? '').trim().toLowerCase();
  const location: string = (body.location ?? '').trim().toLowerCase();

  if (!niche || !location) {
    return NextResponse.json({ error: 'niche and location are required' }, { status: 400 });
  }

  // Cache check: same niche+location today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existingSearch } = await supabase
    .from('searches')
    .select('id')
    .eq('niche', niche)
    .eq('location', location)
    .gte('created_at', todayStart.toISOString())
    .maybeSingle();

  if (existingSearch) {
    const { data: businesses } = await supabase
      .from('businesses')
      .select('*')
      .eq('search_id', existingSearch.id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ search_id: existingSearch.id, businesses: businesses ?? [] });
  }

  // Google Places API key check
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY is not configured' }, { status: 503 });
  }

  // Run all 5 sub-queries concurrently
  const subQueries = buildSubQueries(niche, location);
  const searchResponses = await Promise.all(
    subQueries.map((q) =>
      fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${apiKey}`
      ).then((r) => r.json())
    )
  );

  // Deduplicate across all sub-query results by place_id
  type RawPlace = { place_id: string; name: string; formatted_address?: string };
  const seenPlaceIds = new Set<string>();
  const allPlaces: RawPlace[] = [];

  for (const searchData of searchResponses) {
    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') continue;
    for (const place of searchData.results ?? []) {
      if (!seenPlaceIds.has(place.place_id)) {
        seenPlaceIds.add(place.place_id);
        allPlaces.push(place);
      }
    }
  }

  // At least one sub-query must have succeeded
  const allFailed = searchResponses.every(
    (r) => r.status !== 'OK' && r.status !== 'ZERO_RESULTS'
  );
  if (allFailed) {
    return NextResponse.json(
      { error: `Google Places error: ${searchResponses[0]?.status}` },
      { status: 502 }
    );
  }

  // Create search record
  const { data: newSearch, error: searchInsertError } = await supabase
    .from('searches')
    .insert({ niche, location })
    .select('id')
    .single();

  if (searchInsertError || !newSearch) {
    return NextResponse.json({ error: 'Failed to create search record' }, { status: 500 });
  }

  const businesses = [];

  // Fetch Places Details for each unique place (website + phone)
  for (const place of allPlaces) {
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,website,formatted_phone_number&key=${apiKey}`
    );
    const detailsData = await detailsRes.json();
    const d = detailsData.result ?? {};

    const { data: business } = await supabase
      .from('businesses')
      .insert({
        search_id: newSearch.id,
        name: d.name ?? place.name,
        address: d.formatted_address ?? place.formatted_address ?? '',
        website: d.website ?? null,
        phone: d.formatted_phone_number ?? null,
      })
      .select()
      .single();

    if (business) businesses.push(business);
  }

  return NextResponse.json({ search_id: newSearch.id, businesses });
}

// ── Google Places single-query reference (original, 20-result cap) ────────────
//
// const query = encodeURIComponent(`${niche} in ${location}`);
// const searchRes = await fetch(
//   `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`
// );
// const searchData = await searchRes.json();
//
// if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
//   return NextResponse.json(
//     { error: `Google Places error: ${searchData.status}` },
//     { status: 502 }
//   );
// }
//
// const places = (searchData.results ?? []).slice(0, 20);
// ─────────────────────────────────────────────────────────────────────────────
