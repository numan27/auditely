// app/api/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';

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

  // Text Search
  const query = encodeURIComponent(`${niche} in ${location}`);
  const searchRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`
  );
  const searchData = await searchRes.json();

  if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
    return NextResponse.json(
      { error: `Google Places error: ${searchData.status}` },
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

  const places: Array<{ place_id: string; name: string; formatted_address?: string }> =
    (searchData.results ?? []).slice(0, 20);

  const businesses = [];

  for (const place of places) {
    // Places Details for website + phone
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
