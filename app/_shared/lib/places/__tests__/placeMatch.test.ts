// Google's place details are kept 30 days. A search run again after that matches
// what Google sends now to the rows already saved, so each business keeps its
// audit: by Google's place id, else by website, else by name and address.

import { describe, it, expect } from 'vitest';
import { PLACE_DATA_DAYS, placeDataCutoff, placeDataFresh } from '@/app/_shared/lib/places/placeData';
import { matchPlaces, type SavedPlace } from '@/app/_shared/lib/places/placeMatch';
import type { PlaceResult } from '@/app/_shared/lib/places/types';

const NOW = new Date('2026-11-30T12:00:00.000Z');

describe('placeData', () => {
  it('keeps place details 30 days', () => {
    expect(PLACE_DATA_DAYS).toBe(30);
    expect(placeDataCutoff(NOW)).toBe('2026-10-31T12:00:00.000Z');
    expect(placeDataFresh('2026-10-31T12:00:00.000Z', NOW)).toBe(true);
    expect(placeDataFresh('2026-10-31T11:59:59.999Z', NOW)).toBe(false);
    expect(placeDataFresh('2026-11-29T00:00:00.000Z', NOW)).toBe(true);
  });
});

const place = (name: string, extra: Partial<PlaceResult> = {}): PlaceResult => ({
  name,
  address: `${name} St, Austin, TX`,
  website: null,
  phone: null,
  placeId: null,
  ...extra,
});

const saved = (id: string, extra: Partial<SavedPlace> = {}): SavedPlace => ({
  id,
  place_id: null,
  name: '',
  address: '',
  website: null,
  ...extra,
});

describe('matchPlaces', () => {
  it("matches by Google's place id first", () => {
    const result = matchPlaces(
      [saved('b1', { place_id: 'p1', name: 'Old name' }), saved('b2', { place_id: 'p2' })],
      [place('Smile Co', { placeId: 'p2' }), place('Bright Dental', { placeId: 'p1' })]
    );
    expect(result.matched).toEqual([
      { id: 'b2', place: expect.objectContaining({ name: 'Smile Co' }) },
      { id: 'b1', place: expect.objectContaining({ name: 'Bright Dental' }) },
    ]);
    expect(result.added).toEqual([]);
  });

  it('matches a row saved before place ids by its website, whatever the scheme, www or path', () => {
    const result = matchPlaces(
      [saved('b1', { website: 'http://www.smile.com/' })],
      [place('Smile Co', { placeId: 'p9', website: 'https://smile.com/home' })]
    );
    expect(result.matched).toEqual([{ id: 'b1', place: expect.objectContaining({ placeId: 'p9' }) }]);
  });

  it('matches by name and address when there is no website, ignoring case and spaces', () => {
    const result = matchPlaces(
      [saved('b1', { name: 'SMILE co ', address: ' Smile Co St, Austin, TX' })],
      [place('Smile Co', { placeId: 'p9' })]
    );
    expect(result.matched).toEqual([{ id: 'b1', place: expect.objectContaining({ placeId: 'p9' }) }]);
  });

  it("never matches on details that were erased, and a row's place id beats a lookalike", () => {
    const result = matchPlaces(
      [saved('erased'), saved('b2', { place_id: 'p2', website: 'https://smile.com' })],
      [place('', { address: '', placeId: 'p1' }), place('Smile Co', { placeId: 'p2', website: 'https://smile.com' })]
    );
    expect(result.matched).toEqual([{ id: 'b2', place: expect.objectContaining({ placeId: 'p2' }) }]);
    expect(result.added).toEqual([expect.objectContaining({ placeId: 'p1' })]);
  });

  it('matches each saved row once, and adds the places it has no row for, in Google’s order', () => {
    const result = matchPlaces(
      [saved('b1', { website: 'https://smile.com' })],
      [
        place('Smile Co', { placeId: 'p1', website: 'https://smile.com' }),
        place('Smile Co Downtown', { placeId: 'p2', website: 'https://smile.com' }),
        place('Bright Dental', { placeId: 'p3' }),
      ]
    );
    expect(result.matched).toEqual([{ id: 'b1', place: expect.objectContaining({ placeId: 'p1' }) }]);
    expect(result.added.map((p) => p.placeId)).toEqual(['p2', 'p3']);
    // Google's order across both, for the list
    expect(result.order).toEqual([
      { id: 'b1', place: expect.objectContaining({ placeId: 'p1' }) },
      { id: null, place: expect.objectContaining({ placeId: 'p2' }) },
      { id: null, place: expect.objectContaining({ placeId: 'p3' }) },
    ]);
  });

  it("doesn't match a row whose place id names a different place", () => {
    const result = matchPlaces(
      [saved('b1', { place_id: 'p-old', website: 'https://smile.com' })],
      [place('Smile Co', { placeId: 'p-new', website: 'https://smile.com' })]
    );
    expect(result.matched).toEqual([]);
    expect(result.added).toHaveLength(1);
  });
});
