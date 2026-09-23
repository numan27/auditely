// app/api/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';

// 5 geographic sub-queries to work around Google Places' 20-result-per-query cap.
// Deduplication by place id gives up to ~100 unique results per search.
function buildSubQueries(niche: string, location: string): string[] {
  return [
    `${niche} in ${location}`,
    `${niche} in north ${location}`,
    `${niche} in south ${location}`,
    `${niche} in east ${location}`,
    `${niche} in west ${location}`,
  ];
}

// Places API (New) Text Search returns website + phone inline, so no separate
// Place Details request is needed. The field mask controls which fields (and
// billing tier) are returned.
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber';

interface NewPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
}

interface SearchResponseData {
  places?: NewPlace[];
  error?: { status?: string; message?: string };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const niche: string = (body.niche ?? '').trim().toLowerCase();
  const location: string = (body.location ?? '').trim().toLowerCase();

  if (!niche || !location) {
    return NextResponse.json({ error: 'niche and location are required' }, { status: 400 });
  }

  // Cache check: same niche+location ever searched before
  const { data: existingSearch } = await supabase
    .from('searches')
    .select('id')
    .eq('niche', niche)
    .eq('location', location)
    .order('created_at', { ascending: false })
    .limit(1)
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

  // Run all 5 sub-queries concurrently against Places API (New) Text Search.
  // Legacy `maps/api/place/textsearch/json` is disabled for newer projects
  // (returns REQUEST_DENIED).
  const subQueries = buildSubQueries(niche, location);
  const searchResponses = await Promise.all(
    subQueries.map(async (q) => {
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': FIELD_MASK,
          },
          body: JSON.stringify({ textQuery: q }),
        });
        const data: SearchResponseData = await res.json();
        return { ok: res.ok, status: res.status, data };
      } catch {
        return { ok: false, status: 0, data: {} as SearchResponseData };
      }
    })
  );

  // Deduplicate across all sub-query results by place id
  const seenPlaceIds = new Set<string>();
  const allPlaces: NewPlace[] = [];

  for (const resp of searchResponses) {
    if (!resp.ok) continue;
    for (const place of resp.data.places ?? []) {
      if (place.id && !seenPlaceIds.has(place.id)) {
        seenPlaceIds.add(place.id);
        allPlaces.push(place);
      }
    }
  }

  // At least one sub-query must have succeeded
  const allFailed = searchResponses.every((r) => !r.ok);
  if (allFailed) {
    const firstError = searchResponses[0]?.data?.error?.status ?? searchResponses[0]?.status;
    return NextResponse.json(
      { error: `Google Places error: ${firstError}` },
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

  // Persist all unique places in one bulk insert. Text Search (New) already
  // returned website + phone. Rows in one insert share NOW(), so created_at is
  // staggered by 1ms to keep Google's relevance order for later reads.
  let businesses: unknown[] = [];
  if (allPlaces.length > 0) {
    const insertedAt = Date.now();
    const { data, error: businessInsertError } = await supabase
      .from('businesses')
      .insert(
        allPlaces.map((place, i) => ({
          search_id: newSearch.id,
          name: place.displayName?.text ?? '',
          address: place.formattedAddress ?? '',
          website: place.websiteUri ?? null,
          phone: place.nationalPhoneNumber ?? null,
          created_at: new Date(insertedAt + i).toISOString(),
        }))
      )
      .select();

    if (businessInsertError) {
      console.error('[search] Failed to store businesses:', businessInsertError.message);
      return NextResponse.json({ error: 'Failed to store businesses' }, { status: 500 });
    }
    businesses = data ?? [];
  }

  return NextResponse.json({ search_id: newSearch.id, businesses });
}
