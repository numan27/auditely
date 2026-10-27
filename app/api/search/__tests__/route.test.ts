import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/search/route';
import { searchPlaces } from '@/app/_shared/lib/places/searchPlaces';

// Fake Supabase for a first-time search: no cached search (unless cachedSearch is
// set), then the search and business inserts succeed (unless searchInsertError or
// businessInsertError is set). Every insert payload is recorded per table, and every
// read and delete with its eq() filters and its gte() ranges.
const db = vi.hoisted(() => {
  const inserts: Record<string, unknown> = {};
  const state = {
    businessInsertError: null as string | null,
    searchInsertError: null as string | null,
    cachedSearch: null as { id: string } | null,
    reads: [] as { table: string; filters: unknown[][]; ranges: unknown[][] }[],
    deletes: [] as { table: string; filters: unknown[][] }[],
  };
  const from = (table: string) => {
    let payload: unknown;
    let deleting = false;
    const filters: unknown[][] = [];
    const ranges: unknown[][] = [];
    const result = () => {
      if (deleting) {
        state.deletes.push({ table, filters });
        return { data: null, error: null };
      }
      if (payload === undefined) {
        state.reads.push({ table, filters, ranges }); // the cache lookup
        if (table === 'searches') return { data: state.cachedSearch, error: null };
        return { data: [{ id: 'biz-cached' }], error: null };
      }
      if (table === 'searches' && state.searchInsertError) return { data: null, error: { message: state.searchInsertError } };
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
      gte: (column: string, value: unknown) => {
        ranges.push([column, value]);
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

const session = vi.hoisted(() => ({ current: null as unknown }));
// The route runs as the signed-in user: the service client must stay unused
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
  ownerUserId: async () => 'owner-1',
}));
vi.mock('@/app/_shared/lib/places/searchPlaces', () => ({ searchPlaces: vi.fn() }));
// Each account's meter; refusal() stays real
const meter = vi.hoisted(() => ({ claim: vi.fn(), release: vi.fn() }));
vi.mock('@/app/_shared/lib/usage/usage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/usage/usage')>()),
  meterFor: () => ({ claim: meter.claim, notOnPlan: () => null }),
}));

const freeSearchLimit = { kind: 'search', plan: 'free', limit: 1, resetsAt: '2026-11-01T00:00:00.000Z' };
const ONE_PLACE = { ok: true as const, places: [{ name: 'Smile Dental', address: '1 Main St', website: null, phone: null }] };

async function post(body: Record<string, unknown>) {
  const res = await POST(new NextRequest('http://localhost/api/search', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  session.current = { db: { from: db.from }, account: { id: 'owner-1', email: 'owner@example.com', isOwner: true } };
  for (const key of Object.keys(db.inserts)) delete db.inserts[key];
  db.state.businessInsertError = null;
  db.state.searchInsertError = null;
  db.state.cachedSearch = null;
  db.state.reads = [];
  db.state.deletes = [];
  vi.mocked(searchPlaces).mockReset();
  meter.release.mockReset().mockResolvedValue(undefined);
  meter.claim.mockReset().mockResolvedValue({ ok: true, release: meter.release });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/search', () => {
  it("reuses only this account's own earlier search, not just what Row Level Security lets through", async () => {
    session.current = { db: { from: db.from }, account: { id: 'user-2', email: 'tester@example.com', isOwner: false } };
    vi.mocked(searchPlaces).mockResolvedValue({ ok: true, places: [] });
    await post({ niche: 'Dentist', location: 'Austin' });

    expect(db.state.reads).toEqual([
      {
        table: 'searches',
        filters: [['user_id', 'user-2'], ['niche', 'dentist'], ['location', 'austin']],
        ranges: [['created_at', expect.any(String)]],
      },
    ]);
  });

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

  it('reuses only a search under 30 days old', async () => {
    vi.mocked(searchPlaces).mockResolvedValue({ ok: true, places: [] });
    await post({ niche: 'dentist', location: 'austin' });
    expect(db.state.reads[0].ranges).toEqual([['created_at', expect.any(String)]]);
    const since = db.state.reads[0].ranges[0][1] as string;
    expect(Date.now() - Date.parse(since)).toBeGreaterThan(29.9 * 864e5);
    expect(Date.now() - Date.parse(since)).toBeLessThan(30.1 * 864e5);
  });

  it('claims a search before calling Google', async () => {
    vi.mocked(searchPlaces).mockResolvedValue(ONE_PLACE);
    const { status } = await post({ niche: 'dentist', location: 'austin' });
    expect(status).toBe(200);
    expect(meter.claim).toHaveBeenCalledWith('search');
    expect(meter.claim.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(searchPlaces).mock.invocationCallOrder[0]);
    expect(meter.release).not.toHaveBeenCalled();
  });

  it('refuses at the limit without calling Google', async () => {
    meter.claim.mockResolvedValue({ ok: false, status: 402, error: "You've used this month's search. You get another on Nov 1.", limit: freeSearchLimit });
    const { status, json } = await post({ niche: 'dentist', location: 'austin' });
    expect(status).toBe(402);
    expect(json).toEqual({ error: "You've used this month's search. You get another on Nov 1.", limit: freeSearchLimit });
    expect(searchPlaces).not.toHaveBeenCalled();
    expect(db.inserts.searches).toBeUndefined();
  });

  it('gives the search back when Google fails', async () => {
    vi.mocked(searchPlaces).mockResolvedValue({ ok: false, status: 502, error: 'Places search failed' });
    const { status } = await post({ niche: 'dentist', location: 'austin' });
    expect(status).toBe(502);
    expect(meter.release).toHaveBeenCalledTimes(1);
  });

  it("gives the search back when the search can't be saved", async () => {
    vi.mocked(searchPlaces).mockResolvedValue(ONE_PLACE);
    db.state.searchInsertError = 'permission denied for table searches';
    const { status } = await post({ niche: 'dentist', location: 'austin' });
    expect(status).toBe(500);
    expect(meter.release).toHaveBeenCalledTimes(1);
  });

  it('gives the search back when the businesses cannot be stored', async () => {
    vi.mocked(searchPlaces).mockResolvedValue(ONE_PLACE);
    db.state.businessInsertError = 'insert failed';
    const { status } = await post({ niche: 'dentist', location: 'austin' });
    expect(status).toBe(500);
    expect(meter.release).toHaveBeenCalledTimes(1);
  });

  it('keeps the claim for a search that finds nothing', async () => {
    vi.mocked(searchPlaces).mockResolvedValue({ ok: true, places: [] });
    const { status, json } = await post({ niche: 'dentist', location: 'austin' });
    expect(status).toBe(200);
    expect(json).toEqual({ search_id: 'search-1', businesses: [] });
    expect(meter.release).not.toHaveBeenCalled();
  });

  it('does not claim when a recent search is reused', async () => {
    db.state.cachedSearch = { id: 'search-old' };
    const { status, json } = await post({ niche: 'dentist', location: 'austin' });
    expect(status).toBe(200);
    expect(json).toEqual({ search_id: 'search-old', businesses: [{ id: 'biz-cached' }] });
    expect(meter.claim).not.toHaveBeenCalled();
    expect(searchPlaces).not.toHaveBeenCalled();
  });
});
