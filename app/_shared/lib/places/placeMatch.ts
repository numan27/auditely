// app/_shared/lib/places/placeMatch.ts

// A search run again matches what Google sends now to the rows it saved before,
// so each business keeps its audit and outreach: by Google's place id first,
// then (for rows saved before place ids were kept) by website, then by name and
// address. Details that were erased match nothing. Each row matches once.

import type { PlaceResult } from '@/app/_shared/lib/places/types';

/** What a saved row offers to match on */
export interface SavedPlace {
  id: string;
  place_id: string | null;
  name: string;
  address: string;
  website: string | null;
}

export interface PlaceMatches {
  /** Places that are saved rows, by the row's id */
  matched: { id: string; place: PlaceResult }[];
  /** Places with no row yet */
  added: PlaceResult[];
  /** Every place in Google's order, with its row's id or null */
  order: { id: string | null; place: PlaceResult }[];
}

const text = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

function siteKey(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    const url = new URL(website.includes('://') ? website : `https://${website}`);
    return url.hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

const listingKey = (name: string, address: string) => (text(name) ? `${text(name)}|${text(address)}` : null);

export function matchPlaces(saved: SavedPlace[], places: PlaceResult[]): PlaceMatches {
  const rowFor: (string | null)[] = places.map(() => null);
  const taken = new Set<string>();

  // Place ids first, across the whole list, so a lookalike can't take a row its own place comes back for
  const byPlaceId = new Map(saved.filter((row) => row.place_id).map((row) => [row.place_id as string, row.id]));
  places.forEach((place, i) => {
    const id = place.placeId ? byPlaceId.get(place.placeId) : undefined;
    if (id && !taken.has(id)) {
      rowFor[i] = id;
      taken.add(id);
    }
  });

  // Then rows without a place id, which can't say which place they were
  const older = saved.filter((row) => !row.place_id);
  places.forEach((place, i) => {
    if (rowFor[i]) return;
    const site = siteKey(place.website);
    const listing = listingKey(place.name, place.address);
    const row =
      older.find((r) => !taken.has(r.id) && site !== null && siteKey(r.website) === site) ??
      older.find((r) => !taken.has(r.id) && listing !== null && listingKey(r.name, r.address) === listing);
    if (row) {
      rowFor[i] = row.id;
      taken.add(row.id);
    }
  });

  const order = places.map((place, i) => ({ id: rowFor[i], place }));
  return {
    matched: order.filter((entry): entry is { id: string; place: PlaceResult } => entry.id !== null),
    added: order.filter((entry) => entry.id === null).map((entry) => entry.place),
    order,
  };
}
