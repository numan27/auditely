import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/audit-url/route';

type Result = { data: unknown; error: { message: string } | null };

// Chainable fake of the Supabase query builder; responses are queued per `table.op`
const db = vi.hoisted(() => {
  const state = {
    responses: {} as Record<string, Result[]>,
    calls: [] as { table: string; op: string; payload?: unknown }[],
  };
  const from = (table: string) => {
    let op = 'select';
    let payload: unknown;
    const resolve = (): Promise<Result> => {
      state.calls.push({ table, op, payload });
      const queue = state.responses[`${table}.${op}`] ?? [];
      return Promise.resolve((queue.length > 1 ? queue.shift() : queue[0]) ?? { data: null, error: null });
    };
    const chain = {
      select: () => chain,
      insert: (value: unknown) => ((op = 'insert'), (payload = value), chain),
      eq: () => chain,
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
