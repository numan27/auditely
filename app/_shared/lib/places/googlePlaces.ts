// app/_shared/lib/places/googlePlaces.ts

// Google Places API (New): Text Search for businesses, Autocomplete for cities.

import type { CitySuggestion, PlaceResult, PlacesSearchOutcome } from '@/app/_shared/lib/places/types';

// Places API (New) autocomplete response shape (only fields we read).
interface PlacePrediction {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
  };
}

export async function autocompleteGoogleCities(input: string, apiKey: string): Promise<CitySuggestion[]> {
  try {
    // Places API (New) — legacy `maps/api/place/autocomplete/json` is disabled
    // for projects created after March 2025 and returns REQUEST_DENIED.
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input,
        includedPrimaryTypes: ['(cities)'],
        // Cities anywhere: the beta's testers aren't all in the US
        // includedRegionCodes: ['us'],
      }),
      signal: AbortSignal.timeout(4000),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(
        '[autocomplete] Places API (New) error:',
        data?.error?.status ?? res.status,
        data?.error?.message ?? ''
      );
      return [];
    }

    const suggestions: CitySuggestion[] = [];
    for (const s of (data.suggestions ?? []) as PlacePrediction[]) {
      const description = s.placePrediction?.text?.text;
      const placeId = s.placePrediction?.placeId;
      if (description && placeId) {
        suggestions.push({ description, placeId });
      }
    }
    return suggestions;
  } catch {
    return [];
  }
}

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
// billing tier) are returned: website and phone already put the request in the
// Enterprise tier, which also covers rating and review count at no extra cost.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
].join(',');

interface NewPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
}

interface SearchResponseData {
  places?: NewPlace[];
  error?: { status?: string; message?: string };
}

export async function searchGooglePlaces(
  niche: string,
  location: string,
  apiKey: string
): Promise<PlacesSearchOutcome> {
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

  // At least one sub-query must have succeeded
  const allFailed = searchResponses.every((r) => !r.ok);
  if (allFailed) {
    const firstError = searchResponses[0]?.data?.error?.status ?? searchResponses[0]?.status;
    console.error('[search] Google Places error:', firstError);
    return { ok: false, status: 502, error: "Couldn't search Google Maps just now. Try again in a minute." };
  }

  // Deduplicate across all sub-query results by place id
  const seenPlaceIds = new Set<string>();
  const places: PlaceResult[] = [];

  for (const resp of searchResponses) {
    if (!resp.ok) continue;
    for (const place of resp.data.places ?? []) {
      if (place.id && !seenPlaceIds.has(place.id)) {
        seenPlaceIds.add(place.id);
        places.push({
          name: place.displayName?.text ?? '',
          address: place.formattedAddress ?? '',
          website: place.websiteUri ?? null,
          phone: place.nationalPhoneNumber ?? null,
          // Google omits both for a place with no reviews
          rating: place.rating ?? null,
          reviewCount: place.userRatingCount ?? 0,
        });
      }
    }
  }

  return { ok: true, places };
}
