// app/_shared/lib/places/types.ts

// A business found by a places provider, in the shape the `businesses` table stores.
export interface PlaceResult {
  name: string;
  address: string;
  website: string | null;
  phone: string | null;
}

export type PlacesSearchOutcome =
  | { ok: true; places: PlaceResult[] }
  | { ok: false; status: number; error: string };

export interface CitySuggestion {
  description: string;
  placeId: string;
}
