// app/_shared/lib/places/searchPlaces.ts

// Business search runs on Google Places. The free Geoapify provider is kept but
// switched off — to use it again, uncomment its import and the block below.

// import { searchGeoapifyPlaces } from '@/app/_shared/lib/places/geoapify';
import { searchGooglePlaces } from '@/app/_shared/lib/places/googlePlaces';
import type { PlacesSearchOutcome } from '@/app/_shared/lib/places/types';

const missingKey = (name: string): PlacesSearchOutcome => ({
  ok: false,
  status: 503,
  error: `${name} is not configured`,
});

export async function searchPlaces(niche: string, location: string): Promise<PlacesSearchOutcome> {
  // Geoapify (free, OpenStreetMap data) — disabled; PLACES_PROVIDER is ignored meanwhile.
  // if (process.env.PLACES_PROVIDER !== 'google') {
  //   const geoapifyKey = process.env.GEOAPIFY_API_KEY;
  //   if (!geoapifyKey) return missingKey('GEOAPIFY_API_KEY');
  //   return searchGeoapifyPlaces(niche, location, geoapifyKey);
  // }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return missingKey('GOOGLE_PLACES_API_KEY');
  return searchGooglePlaces(niche, location, apiKey);
}
