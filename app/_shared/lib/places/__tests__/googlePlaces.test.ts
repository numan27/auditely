import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { autocompleteGoogleCities } from '@/app/_shared/lib/places/googlePlaces';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('autocompleteGoogleCities', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('asks Places (New) for US cities and returns their labels', async () => {
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
    expect(JSON.parse(init.body)).toMatchObject({ input: 'aus', includedPrimaryTypes: ['(cities)'], includedRegionCodes: ['us'] });
  });

  it('returns nothing when Google errors', async () => {
    fetchMock.mockResolvedValue(json({ error: { status: 'PERMISSION_DENIED' } }, 403));
    expect(await autocompleteGoogleCities('aus', 'key')).toEqual([]);
  });
});
