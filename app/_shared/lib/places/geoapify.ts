// app/_shared/lib/places/geoapify.ts

// Geoapify (OpenStreetMap data) — the free provider used outside production.
// Free plan: 3,000 credits/day. Autocomplete and geocoding cost 1 credit per
// request; Places costs 1 credit per 20 results. Results may be stored.

import { categoriesForNiche, nicheNameStem } from '@/app/_shared/lib/places/geoapifyCategories';
import { searchOverpassByName } from '@/app/_shared/lib/places/overpass';
import type { CitySuggestion, PlaceResult, PlacesSearchOutcome } from '@/app/_shared/lib/places/types';

const GEOAPIFY_BASE = 'https://api.geoapify.com';

// Matches the Google path's ceiling (5 sub-queries × 20) and costs 5 credits
const PLACES_LIMIT = 100;

interface GeocodeResult {
  place_id?: string;
  lon?: number;
  lat?: number;
  bbox?: { lon1: number; lat1: number; lon2: number; lat2: number };
  name?: string;
  city?: string;
  state_code?: string;
  state?: string;
}

interface PlaceFeature {
  properties?: {
    name?: string;
    formatted?: string;
    address_line2?: string;
    website?: string;
    contact?: { phone?: string };
  };
}

function geoapifyUrl(path: string, params: Record<string, string>, apiKey: string): string {
  const url = new URL(path, GEOAPIFY_BASE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('apiKey', apiKey);
  return url.toString();
}

// "Austin, TX, USA" — same shape Google's autocomplete produced, so locations
// already cached in `searches` keep matching. Neighbourhoods keep their own
// name: "Brooklyn, New York, NY, USA".
function cityLabel(result: GeocodeResult): string | null {
  const place = result.name ?? result.city;
  if (!place) return null;
  const state = result.state_code?.toUpperCase() ?? result.state;
  const parent = result.city && result.city !== place ? result.city : null;
  return [place, parent, state, 'USA'].filter(Boolean).join(', ');
}

export async function autocompleteCities(input: string, apiKey: string): Promise<CitySuggestion[]> {
  try {
    const url = geoapifyUrl(
      '/v1/geocode/autocomplete',
      { text: input, type: 'city', filter: 'countrycode:us', format: 'json', limit: '5' },
      apiKey
    );
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();

    if (!res.ok) {
      console.error('[autocomplete] Geoapify error:', res.status, data?.message ?? '');
      return [];
    }

    const seen = new Set<string>();
    const suggestions: CitySuggestion[] = [];
    for (const result of (data.results ?? []) as GeocodeResult[]) {
      const description = cityLabel(result);
      if (description && result.place_id && !seen.has(description)) {
        seen.add(description);
        suggestions.push({ description, placeId: result.place_id });
      }
    }
    return suggestions;
  } catch {
    return [];
  }
}

// OSM often maps one business twice (a point and its building outline)
function dedupePlaces(places: PlaceResult[]): PlaceResult[] {
  const seen = new Set<string>();
  return places.filter((p) => {
    const key = `${p.name}|${p.address}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchGeoapifyPlaces(
  niche: string,
  location: string,
  apiKey: string
): Promise<PlacesSearchOutcome> {
  try {
    // 1. Resolve the location to an area so Places can search inside its boundary
    const geocodeRes = await fetch(
      geoapifyUrl(
        '/v1/geocode/search',
        { text: location, filter: 'countrycode:us', format: 'json', limit: '1' },
        apiKey
      ),
      { signal: AbortSignal.timeout(10000) }
    );
    if (!geocodeRes.ok) return { ok: false, status: 502, error: `Geoapify error: ${geocodeRes.status}` };

    const area = ((await geocodeRes.json()).results ?? [])[0] as GeocodeResult | undefined;
    if (!area?.place_id) {
      return { ok: false, status: 400, error: `Could not find location "${location}"` };
    }

    // 2a. No Geoapify category for this niche → search OpenStreetMap by name
    const categories = categoriesForNiche(niche);
    if (!categories) {
      if (!area.bbox) return { ok: true, places: [] };
      const { lon1, lat1, lon2, lat2 } = area.bbox;
      const outcome = await searchOverpassByName(nicheNameStem(niche), { south: lat1, west: lon1, north: lat2, east: lon2 });
      return outcome.ok ? { ok: true, places: dedupePlaces(outcome.places) } : outcome;
    }

    // 2b. Businesses in that area, nearest to its centre first
    const params: Record<string, string> = {
      categories: categories.join(','),
      filter: `place:${area.place_id}`,
      limit: String(PLACES_LIMIT),
    };
    if (area.lon !== undefined && area.lat !== undefined) params.bias = `proximity:${area.lon},${area.lat}`;

    const placesRes = await fetch(geoapifyUrl('/v2/places', params, apiKey), {
      signal: AbortSignal.timeout(15000),
    });
    if (!placesRes.ok) return { ok: false, status: 502, error: `Geoapify error: ${placesRes.status}` };

    const places: PlaceResult[] = [];
    for (const feature of ((await placesRes.json()).features ?? []) as PlaceFeature[]) {
      const p = feature.properties;
      // Unnamed POIs aren't usable leads
      if (!p?.name) continue;
      places.push({
        name: p.name,
        address: p.address_line2 ?? p.formatted ?? '',
        website: p.website ?? null,
        phone: p.contact?.phone ?? null,
      });
    }
    return { ok: true, places: dedupePlaces(places) };
  } catch {
    return { ok: false, status: 502, error: 'Geoapify error: request failed' };
  }
}
