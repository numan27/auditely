import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/search/route';
import { searchPlaces } from '@/app/_shared/lib/places/searchPlaces';

// Fake Supabase for a first-time search: no cached search, then the search and
// business inserts succeed (unless businessInsertError is set). Every insert
// payload is recorded per table, and every delete with its eq() filters.
const db = vi.hoisted(() => {
  const inserts: Record<string, unknown> = {};
  const state = { businessInsertError: null as string | null, deletes: [] as { table: string; filters: unknown[][] }[] };
  const from = (table: string) => {
    let payload: unknown;
    let deleting = false;
    const filters: unknown[][] = [];
    const result = () => {
      if (deleting) {
        state.deletes.push({ table, filters });
        return { data: null, error: null };
      }
      if (payload === undefined) return { data: null, error: null }; // the cache lookup
      if (table === 'businesses' && state.businessInsertError) return { data: null, error: { message: state.businessInsertError } };
      return table === 'searches'
        ? { data: { id: 'search-1' }, error: null }
        : { data: (payload as object[]).map((row, i) => ({ id: `biz-${i}`, ...row })), error: null };
    };
    const chain = {
      select: () => chain,
      insert: (value: unknown) => {
        payload = value;
        inserts[table] = value;
        return chain;
      },
      delete: () => {
        deleting = true;
        return chain;
      },
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      single: async () => result(),
      maybeSingle: async () => result(),
      then: (onOk: (r: unknown) => unknown) => Promise.resolve(result()).then(onOk),
    };
    return chain;
  };
  return { inserts, state, from };
});

vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));
vi.mock('@/app/_shared/lib/places/searchPlaces', () => ({ searchPlaces: vi.fn() }));

async function post(body: Record<string, unknown>) {
  const res = await POST(new NextRequest('http://localhost/api/search', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  for (const key of Object.keys(db.inserts)) delete db.inserts[key];
  db.state.businessInsertError = null;
  db.state.deletes = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/search', () => {
  it("stores each business's Google rating and review count", async () => {
    vi.mocked(searchPlaces).mockResolvedValue({
      ok: true,
      places: [
        { name: 'Smile Dental', address: '1 Main St', website: 'https://smile.com', phone: null, rating: 4.6, reviewCount: 123 },
        // A provider without ratings (Geoapify, OpenStreetMap) leaves both out
        { name: 'Other Dental', address: '2 Main St', website: null, phone: null },
      ],
    });
    const { status } = await post({ niche: 'dentist', location: 'austin' });

    expect(status).toBe(200);
    expect(db.inserts.businesses).toMatchObject([
      { search_id: 'search-1', name: 'Smile Dental', rating: 4.6, review_count: 123 },
      { search_id: 'search-1', name: 'Other Dental', rating: null, review_count: null },
    ]);
  });

  it("doesn't leave an empty saved search behind when the businesses can't be stored", async () => {
    // Otherwise the next identical search reuses it and shows "No businesses found"
    vi.mocked(searchPlaces).mockResolvedValue({
      ok: true,
      places: [{ name: 'Smile Dental', address: '1 Main St', website: null, phone: null }],
    });
    db.state.businessInsertError = "Could not find the 'rating' column of 'businesses' in the schema cache";
    const { status, json } = await post({ niche: 'dentist', location: 'austin' });

    expect(status).toBe(500);
    expect(json.error).toBe('Failed to store businesses');
    expect(db.state.deletes).toEqual([{ table: 'searches', filters: [['id', 'search-1']] }]);
  });
});
