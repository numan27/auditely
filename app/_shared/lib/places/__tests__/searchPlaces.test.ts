import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchPlaces } from '@/app/_shared/lib/places/searchPlaces';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

// Google Places is the active provider; Geoapify is commented out in searchPlaces.ts
describe('searchPlaces', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GEOAPIFY_API_KEY', 'geo-key');
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'google-key');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it('searches Google Places, whatever PLACES_PROVIDER says', async () => {
    vi.stubEnv('PLACES_PROVIDER', 'geoapify');
    fetchMock.mockResolvedValue(json({ places: [] }));
    const outcome = await searchPlaces('dentists', 'austin');
    expect(outcome).toEqual({ ok: true, places: [] });
    expect(new URL(fetchMock.mock.calls[0][0]).host).toBe('places.googleapis.com');
  });

  it('reports a missing Google key without calling anything', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    expect(await searchPlaces('dentists', 'austin')).toEqual({
      ok: false,
      status: 503,
      error: 'GOOGLE_PLACES_API_KEY is not configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
