// app/_shared/lib/places/placeData.ts

// Google's terms: a place id may be kept for good, but a business's other details
// from Google (name, address, phone, website, rating) only for a while. Auditely
// keeps them 30 days from when Google sent them. After that a saved search shows
// them as expired until it's run again; audits are Auditely's own and are kept.

export const PLACE_DATA_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The oldest moment place details can have come from Google and still be shown */
export function placeDataCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - PLACE_DATA_DAYS * DAY_MS).toISOString();
}

/** Details Google sent at `fetchedAt` may still be shown */
export function placeDataFresh(fetchedAt: string, now: Date = new Date()): boolean {
  return new Date(fetchedAt).getTime() >= now.getTime() - PLACE_DATA_DAYS * DAY_MS;
}
