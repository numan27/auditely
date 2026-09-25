import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchPlaces } from '@/app/_shared/lib/places/searchPlaces';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('searchPlaces provider selection', () => {
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

  it('uses Geoapify when PLACES_PROVIDER is unset', async () => {
    vi.stubEnv('PLACES_PROVIDER', '');
    fetchMock.mockResolvedValue(json({ results: [], features: [] }));
    await searchPlaces('dentists', 'austin');
    expect(new URL(fetchMock.mock.calls[0][0]).host).toBe('api.geoapify.com');
  });

  it('uses Google when PLACES_PROVIDER=google', async () => {
    vi.stubEnv('PLACES_PROVIDER', 'google');
    fetchMock.mockResolvedValue(json({ places: [] }));
    const outcome = await searchPlaces('dentists', 'austin');
    expect(outcome).toEqual({ ok: true, places: [] });
    expect(new URL(fetchMock.mock.calls[0][0]).host).toBe('places.googleapis.com');
  });

  it('reports the missing key for the selected provider', async () => {
    vi.stubEnv('PLACES_PROVIDER', 'geoapify');
    vi.stubEnv('GEOAPIFY_API_KEY', '');
    expect(await searchPlaces('dentists', 'austin')).toEqual({
      ok: false,
      status: 503,
      error: 'GEOAPIFY_API_KEY is not configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
