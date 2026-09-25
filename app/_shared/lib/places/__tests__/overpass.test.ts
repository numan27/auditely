import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchOverpassByName } from '@/app/_shared/lib/places/overpass';

const BBOX = { south: 30.1, west: -97.94, north: 30.52, east: -97.56 };

describe('searchOverpassByName', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('maps OSM tags to places, building the address from addr:* tags', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          elements: [
            {
              tags: {
                name: 'Kidd Roofing',
                craft: 'roofer',
                website: 'https://www.kiddroof.com/',
                phone: '+1 512-555-0101',
                'addr:housenumber': '12',
                'addr:street': 'Oak St',
                'addr:city': 'Austin',
                'addr:state': 'TX',
                'addr:postcode': '78701',
              },
            },
            { tags: { name: 'JC Roof Construction', 'contact:website': 'http://jcroof.com' } },
            { tags: { craft: 'roofer' } },
          ],
        }),
        { status: 200 }
      )
    );

    expect(await searchOverpassByName('roof', BBOX)).toEqual({
      ok: true,
      places: [
        { name: 'Kidd Roofing', address: '12 Oak St, Austin, TX 78701', website: 'https://www.kiddroof.com/', phone: '+1 512-555-0101' },
        { name: 'JC Roof Construction', address: '', website: 'http://jcroof.com', phone: null },
      ],
    });
  });

  it('searches healthcare and amenity places too, where practices are filed', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ elements: [] }), { status: 200 }));
    await searchOverpassByName('chiropract', BBOX);
    const query = new URLSearchParams(fetchMock.mock.calls[0][1].body).get('data');
    expect(query).toContain('nwr["healthcare"~"chiropract",i]');
    expect(query).toContain('nwr["healthcare"]["name"~"chiropract",i]');
    expect(query).toContain('nwr["amenity"]["name"~"chiropract",i]');
  });

  it('returns a 502 when Overpass is overloaded', async () => {
    fetchMock.mockResolvedValue(new Response('Too many requests', { status: 429 }));
    expect(await searchOverpassByName('roof', BBOX)).toEqual({
      ok: false,
      status: 502,
      error: 'OpenStreetMap search error: 429',
    });
  });
});
