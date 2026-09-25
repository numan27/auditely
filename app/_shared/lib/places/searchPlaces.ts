// app/_shared/lib/places/searchPlaces.ts

// Picks the business-search provider. Staging uses free Geoapify; production
// sets PLACES_PROVIDER=google to use Google Places.

import { searchGeoapifyPlaces } from '@/app/_shared/lib/places/geoapify';
import { searchGooglePlaces } from '@/app/_shared/lib/places/googlePlaces';
import type { PlacesSearchOutcome } from '@/app/_shared/lib/places/types';

const missingKey = (name: string): PlacesSearchOutcome => ({
  ok: false,
  status: 503,
  error: `${name} is not configured`,
});

export async function searchPlaces(niche: string, location: string): Promise<PlacesSearchOutcome> {
  if (process.env.PLACES_PROVIDER === 'google') {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return missingKey('GOOGLE_PLACES_API_KEY');
    return searchGooglePlaces(niche, location, apiKey);
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return missingKey('GEOAPIFY_API_KEY');
  return searchGeoapifyPlaces(niche, location, apiKey);
}
