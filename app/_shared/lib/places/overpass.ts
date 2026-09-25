// app/_shared/lib/places/overpass.ts

// Free OpenStreetMap search via the public Overpass API, used in staging for
// niches Geoapify has no category for (plumbers, roofers, HVAC…). No key; the
// public server is shared and slow (10–20s), so it's for low-volume use only.

import type { PlaceResult, PlacesSearchOutcome } from '@/app/_shared/lib/places/types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_RESULTS = 100;

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface OsmElement {
  tags?: Record<string, string>;
}

function formatAddress(tags: Record<string, string>): string {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const stateZip = [tags['addr:state'], tags['addr:postcode']].filter(Boolean).join(' ');
  return [street, tags['addr:city'], stateZip].filter(Boolean).join(', ');
}

// `stem` comes from nicheNameStem: letters/digits, or one of its trusted regexes.
export async function searchOverpassByName(stem: string, bbox: BoundingBox): Promise<PlacesSearchOutcome> {
  const area = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
  // Tagged as the trade (craft=plumber, healthcare=chiropractor), or a business
  // whose name has the word — practices are usually filed under healthcare/amenity
  const query = `[out:json][timeout:25];(
    nwr["craft"~"${stem}",i]${area};
    nwr["healthcare"~"${stem}",i]${area};
    nwr["craft"]["name"~"${stem}",i]${area};
    nwr["shop"]["name"~"${stem}",i]${area};
    nwr["office"]["name"~"${stem}",i]${area};
    nwr["healthcare"]["name"~"${stem}",i]${area};
    nwr["amenity"]["name"~"${stem}",i]${area};
  );out tags ${MAX_RESULTS};`;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'auditely-staging' },
      body: new URLSearchParams({ data: query }).toString(),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { ok: false, status: 502, error: `OpenStreetMap search error: ${res.status}` };

    const places: PlaceResult[] = [];
    for (const { tags } of ((await res.json()).elements ?? []) as OsmElement[]) {
      if (!tags?.name) continue;
      places.push({
        name: tags.name,
        address: formatAddress(tags),
        website: tags.website ?? tags['contact:website'] ?? null,
        phone: tags.phone ?? tags['contact:phone'] ?? null,
      });
    }
    return { ok: true, places };
  } catch {
    return { ok: false, status: 502, error: 'OpenStreetMap search error: request failed' };
  }
}
