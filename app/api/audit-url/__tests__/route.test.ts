import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from '@/app/api/audit-url/route';

type Result = { data: unknown; error: { message: string } | null };

// Chainable fake of the Supabase query builder; responses are queued per `table.op`
const db = vi.hoisted(() => {
  const state = {
    responses: {} as Record<string, Result[]>,
    calls: [] as { table: string; op: string; payload?: unknown; filters: unknown[][] }[],
  };
  const from = (table: string) => {
    let op = 'select';
    let payload: unknown;
    const filters: unknown[][] = [];
    const resolve = (): Promise<Result> => {
      state.calls.push({ table, op, payload, filters });
      const queue = state.responses[`${table}.${op}`] ?? [];
      return Promise.resolve((queue.length > 1 ? queue.shift() : queue[0]) ?? { data: null, error: null });
    };
    const chain = {
      select: () => chain,
      insert: (value: unknown) => ((op = 'insert'), (payload = value), chain),
      delete: () => ((op = 'delete'), chain),
      eq: (column: string, value: unknown) => (filters.push(['eq', column, value]), chain),
      in: (column: string, values: unknown) => (filters.push(['in', column, values]), chain),
      order: () => chain,
      limit: () => chain,
      single: resolve,
      maybeSingle: resolve,
      then: (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) => resolve().then(onOk, onErr),
    };
    return chain;
  };
  return { state, from };
});

vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));

const ok = (data: unknown): Result => ({ data, error: null });
const inserts = (table: string) => db.state.calls.filter((c) => c.table === table && c.op === 'insert');

async function post(url: unknown) {
  const res = await POST(new NextRequest('http://localhost/api/audit-url', { method: 'POST', body: JSON.stringify({ url }) }));
  return { status: res.status, json: await res.json() };
}

async function remove(body: unknown) {
  const res = await DELETE(new NextRequest('http://localhost/api/audit-url', { method: 'DELETE', body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}
const deletes = () => db.state.calls.filter((c) => c.op === 'delete');

beforeEach(() => {
  db.state.responses = {};
  db.state.calls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/audit-url', () => {
  it('refuses an address the server must not fetch, before touching the database', async () => {
    const { status, json } = await post('http://169.254.169.254/latest');
    expect(status).toBe(400);
    expect(json.error).toMatch(/website address/);
    expect(db.state.calls).toHaveLength(0);
  });

  it('creates the reserved search on first use and stores the site under its domain', async () => {
    db.state.responses = {
      'searches.select': [ok(null)],
      'searches.insert': [ok({ id: 'direct' })],
      'businesses.select': [ok([])],
      'businesses.insert': [ok({ id: 'b1', name: 'washdent.com' })],
    };
    const { status, json } = await post('washdent.com');
    expect(status).toBe(200);
    expect(json).toMatchObject({ existing: false, business: { id: 'b1' } });
    expect(inserts('searches')[0].payload).toEqual({ niche: 'website audits', location: 'added by url' });
    expect(inserts('businesses')[0].payload).toEqual({
      search_id: 'direct',
      name: 'washdent.com',
      address: '',
      website: 'https://washdent.com',
    });
  });

  it('returns the earlier entry, with its audit, when the same site is added again', async () => {
    const audit = { id: 'a1', created_at: '2026-09-28T00:00:00Z' };
    db.state.responses = {
      'searches.select': [ok({ id: 'direct' })],
      'businesses.select': [
        ok([{ id: 'b1', website: 'https://www.washdent.com/' }]),
        ok({ id: 'b1', name: 'washdent.com', audits: { ...audit, ai_reports: null } }),
      ],
    };
    const { json } = await post('http://washdent.com');
    expect(json.existing).toBe(true);
    expect(json.business).toMatchObject({ id: 'b1', audit });
    expect(inserts('businesses')).toHaveLength(0);
  });
});

describe('GET /api/audit-url', () => {
  it('is empty before any site was added', async () => {
    db.state.responses = { 'searches.select': [ok(null)] };
    const res = await GET();
    expect(await res.json()).toEqual({ businesses: [] });
  });

  it("flattens each site's audit and report", async () => {
    db.state.responses = {
      'searches.select': [ok({ id: 'direct' })],
      'businesses.select': [ok([{ id: 'b1', audits: { id: 'a1', ai_reports: { id: 'r1' } } }])],
    };
    const { businesses } = await (await GET()).json();
    expect(businesses).toEqual([{ id: 'b1', audit: { id: 'a1' }, ai_report: { id: 'r1' } }]);
  });
});

describe('DELETE /api/audit-url', () => {
  const A = '6f1c2f0e-8a52-4a53-9d0f-3c1c6b7e2a11';
  const B = '0b9d7c44-1e2a-4f6b-8c3d-5a4e3f2b1c00';

  it('removes the given sites, and only among the websites added by URL', async () => {
    db.state.responses = {
      'searches.select': [ok({ id: 'direct' })],
      'businesses.delete': [ok([{ id: A }, { id: B }])],
    };
    const { status, json } = await remove({ ids: [A, B] });
    expect(status).toBe(200);
    expect(json).toEqual({ removed: [A, B] });
    expect(deletes()).toHaveLength(1);
    expect(deletes()[0].table).toBe('businesses');
    expect(deletes()[0].filters).toEqual([
      ['eq', 'search_id', 'direct'],
      ['in', 'id', [A, B]],
    ]);
  });

  it('reports only what was really removed', async () => {
    db.state.responses = {
      'searches.select': [ok({ id: 'direct' })],
      // B belongs to a lead search: the search_id filter leaves it alone
      'businesses.delete': [ok([{ id: A }])],
    };
    expect((await remove({ ids: [A, B] })).json).toEqual({ removed: [A] });
  });

  it('refuses a request that names no sites, before touching the database', async () => {
    for (const body of [{}, { ids: [] }, { ids: 'all' }, { ids: [A, 7] }, { ids: ['not-an-id'] }, { ids: [`${A}' or true`] }, { all: true }]) {
      const { status, json } = await remove(body);
      expect(status, JSON.stringify(body)).toBe(400);
      expect(json.error).toBeTruthy();
    }
    expect(db.state.calls).toHaveLength(0);
  });

  it('refuses more sites than one list can hold', async () => {
    const { status } = await remove({ ids: Array.from({ length: 501 }, () => A) });
    expect(status).toBe(400);
    expect(db.state.calls).toHaveLength(0);
  });

  it('has nothing to remove before any site was added', async () => {
    db.state.responses = { 'searches.select': [ok(null)] };
    const { status, json } = await remove({ ids: [A] });
    expect(status).toBe(200);
    expect(json).toEqual({ removed: [] });
    expect(deletes()).toHaveLength(0);
  });

  it('says so when the database refuses', async () => {
    db.state.responses = {
      'searches.select': [ok({ id: 'direct' })],
      'businesses.delete': [{ data: null, error: { message: 'boom' } }],
    };
    const { status, json } = await remove({ ids: [A] });
    expect(status).toBe(500);
    expect(json.error).toMatch(/remove/i);
  });
});
