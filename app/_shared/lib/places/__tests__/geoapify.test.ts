import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { autocompleteCities, searchGeoapifyPlaces } from '@/app/_shared/lib/places/geoapify';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const AUSTIN = {
  place_id: 'austin-id',
  name: 'Austin',
  city: 'Austin',
  state_code: 'TX',
  lon: -97.74,
  lat: 30.27,
  bbox: { lon1: -97.94, lat1: 30.1, lon2: -97.56, lat2: 30.52 },
};

describe('autocompleteCities', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('asks for US cities and formats them like "Austin, TX, USA"', async () => {
    fetchMock.mockResolvedValue(json({ results: [AUSTIN] }));
    const suggestions = await autocompleteCities('aus', 'key');

    expect(suggestions).toEqual([{ description: 'Austin, TX, USA', placeId: 'austin-id' }]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/v1/geocode/autocomplete');
    expect(url.searchParams.get('type')).toBe('city');
    expect(url.searchParams.get('filter')).toBe('countrycode:us');
  });

  it('drops duplicate labels and results without a city', async () => {
    fetchMock.mockResolvedValue(
      json({ results: [AUSTIN, { ...AUSTIN, place_id: 'dupe' }, { place_id: 'x', formatted: 'Texas' }] })
    );
    expect(await autocompleteCities('aus', 'key')).toEqual([{ description: 'Austin, TX, USA', placeId: 'austin-id' }]);
  });

  it('labels neighbourhoods with their own name, not just the city', async () => {
    fetchMock.mockResolvedValue(
      json({ results: [{ place_id: 'bk', name: 'Brooklyn', city: 'New York', state_code: 'NY', result_type: 'suburb' }] })
    );
    expect(await autocompleteCities('brook', 'key')).toEqual([
      { description: 'Brooklyn, New York, NY, USA', placeId: 'bk' },
    ]);
  });

  it('returns nothing when the API errors', async () => {
    fetchMock.mockResolvedValue(json({ message: 'Invalid apiKey' }, 401));
    expect(await autocompleteCities('aus', 'key')).toEqual([]);
  });
});

describe('searchGeoapifyPlaces', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('geocodes the location, then searches places inside it', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ results: [AUSTIN] }))
      .mockResolvedValueOnce(
        json({
          features: [
            {
              properties: {
                name: 'Smile Dental',
                address_line1: 'Smile Dental',
                address_line2: '100 Congress Ave, Austin, TX 78701, United States of America',
                website: 'https://smiledental.com',
                contact: { phone: '+1 512-555-0100' },
              },
            },
            { properties: { name: 'No Website Dental', address_line2: '5 Main St, Austin, TX' } },
            { properties: { address_line2: 'Unnamed POI, Austin, TX' } },
          ],
        })
      );

    const outcome = await searchGeoapifyPlaces('dentists', 'austin, tx, usa', 'key');

    expect(outcome).toEqual({
      ok: true,
      places: [
        {
          name: 'Smile Dental',
          address: '100 Congress Ave, Austin, TX 78701, United States of America',
          website: 'https://smiledental.com',
          phone: '+1 512-555-0100',
        },
        { name: 'No Website Dental', address: '5 Main St, Austin, TX', website: null, phone: null },
      ],
    });

    const geocodeUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(geocodeUrl.pathname).toBe('/v1/geocode/search');
    expect(geocodeUrl.searchParams.get('text')).toBe('austin, tx, usa');

    const placesUrl = new URL(fetchMock.mock.calls[1][0]);
    expect(placesUrl.pathname).toBe('/v2/places');
    expect(placesUrl.searchParams.get('categories')).toBe('healthcare.dentist');
    expect(placesUrl.searchParams.get('filter')).toBe('place:austin-id');
    expect(placesUrl.searchParams.get('bias')).toBe('proximity:-97.74,30.27');
    expect(placesUrl.searchParams.has('name')).toBe(false);
  });

  it('searches OpenStreetMap by name inside the area for niches without a category', async () => {
    fetchMock.mockResolvedValueOnce(json({ results: [AUSTIN] })).mockResolvedValueOnce(json({ elements: [] }));
    await searchGeoapifyPlaces('plumbers', 'austin, tx, usa', 'key');

    const [overpassUrl, init] = fetchMock.mock.calls[1];
    expect(new URL(overpassUrl).host).toBe('overpass-api.de');
    const query = new URLSearchParams(init.body).get('data');
    expect(query).toContain('"plumb",i');
    expect(query).toContain('(30.1,-97.94,30.52,-97.56)');
  });

  it('drops the same business mapped twice (point and building)', async () => {
    const dupe = { properties: { name: 'Brooklyn Injury Attorney', address_line2: '999 Flatbush Ave' } };
    fetchMock.mockResolvedValueOnce(json({ results: [AUSTIN] })).mockResolvedValueOnce(json({ features: [dupe, dupe] }));
    const outcome = await searchGeoapifyPlaces('lawyers', 'austin, tx, usa', 'key');
    expect(outcome.ok && outcome.places).toHaveLength(1);
  });

  it('returns a 400 when the location cannot be found', async () => {
    fetchMock.mockResolvedValueOnce(json({ results: [] }));
    const outcome = await searchGeoapifyPlaces('dentists', 'nowhereville', 'key');
    expect(outcome).toEqual({ ok: false, status: 400, error: 'Could not find location "nowhereville"' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a 502 when Geoapify errors', async () => {
    fetchMock.mockResolvedValueOnce(json({ results: [AUSTIN] })).mockResolvedValueOnce(json({}, 429));
    expect(await searchGeoapifyPlaces('dentists', 'austin, tx, usa', 'key')).toEqual({
      ok: false,
      status: 502,
      error: 'Geoapify error: 429',
    });
  });
});
