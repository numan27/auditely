import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { autocompleteGoogleCities, searchGooglePlaces } from '@/app/_shared/lib/places/googlePlaces';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('autocompleteGoogleCities', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('asks Places (New) for cities anywhere, not only in the US, and returns their labels', async () => {
    fetchMock.mockResolvedValue(
      json({
        suggestions: [
          { placePrediction: { placeId: 'austin-id', text: { text: 'Austin, TX, USA' } } },
          { queryPrediction: { text: { text: 'aus' } } },
        ],
      })
    );
    expect(await autocompleteGoogleCities('aus', 'key')).toEqual([{ description: 'Austin, TX, USA', placeId: 'austin-id' }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(init.headers['X-Goog-Api-Key']).toBe('key');
    expect(JSON.parse(init.body)).toEqual({ input: 'aus', includedPrimaryTypes: ['(cities)'] });
  });

  it('returns nothing when Google errors', async () => {
    fetchMock.mockResolvedValue(json({ error: { status: 'PERMISSION_DENIED' } }, 403));
    expect(await autocompleteGoogleCities('aus', 'key')).toEqual([]);
  });
});

describe('searchGooglePlaces', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns each place's Google rating and review count", async () => {
    // Google leaves rating and userRatingCount out for a place nobody has reviewed
    fetchMock.mockImplementation(async () =>
      json({
        places: [
          { id: 'a', displayName: { text: 'Smile Dental' }, formattedAddress: '1 Main St', rating: 4.6, userRatingCount: 123 },
          { id: 'b', displayName: { text: 'New Dental' }, formattedAddress: '2 Main St' },
        ],
      })
    );
    const outcome = await searchGooglePlaces('dentist', 'austin', 'key');

    expect(outcome).toEqual({
      ok: true,
      places: [
        { name: 'Smile Dental', address: '1 Main St', website: null, phone: null, rating: 4.6, reviewCount: 123 },
        { name: 'New Dental', address: '2 Main St', website: null, phone: null, rating: null, reviewCount: 0 },
      ],
    });
    const mask: string = fetchMock.mock.calls[0][1].headers['X-Goog-FieldMask'];
    expect(mask.split(',')).toEqual(expect.arrayContaining(['places.rating', 'places.userRatingCount']));
  });

  it("says in plain words when Google can't be searched, not Google's error code", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockImplementation(async () => json({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429));
    expect(await searchGooglePlaces('dentist', 'austin', 'key')).toEqual({
      ok: false, status: 502, error: "Couldn't search Google Maps just now. Try again in a minute.",
    });
  });
});
