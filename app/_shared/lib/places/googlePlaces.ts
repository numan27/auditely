// app/_shared/lib/places/googlePlaces.ts

// Google Places API (New) Text Search — the production provider.

import type { PlaceResult, PlacesSearchOutcome } from '@/app/_shared/lib/places/types';

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
    return { ok: false, status: 502, error: `Google Places error: ${firstError}` };
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
        });
      }
    }
  }

  return { ok: true, places };
}
