import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET } from '@/app/api/audit-requests/route';

type Result = { data: unknown; error: { message: string } | null };

// Chainable fake of the Supabase query builder; responses are queued per `table.op`
const db = vi.hoisted(() => {
  const state = {
    responses: {} as Record<string, Result[]>,
    calls: [] as { table: string; op: string; filters: unknown[][] }[],
  };
  const from = (table: string) => {
    let op = 'select';
    const filters: unknown[][] = [];
    const resolve = (): Promise<Result> => {
      state.calls.push({ table, op, filters });
      const queue = state.responses[`${table}.${op}`] ?? [];
      return Promise.resolve((queue.length > 1 ? queue.shift() : queue[0]) ?? { data: null, error: null });
    };
    const chain = {
      select: () => chain,
      delete: () => ((op = 'delete'), chain),
      eq: (column: string, value: unknown) => (filters.push(['eq', column, value]), chain),
      in: (column: string, values: unknown) => (filters.push(['in', column, values]), chain),
      order: () => chain,
      then: (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) => resolve().then(onOk, onErr),
    };
    return chain;
  };
  return { state, from };
});

vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));

const ok = (data: unknown): Result => ({ data, error: null });
const ID = '0b6f7c1e-3f2a-4c55-9a0e-2b8d5f6a7c10';

async function remove(body: unknown) {
  const res = await DELETE(new NextRequest('http://localhost/api/audit-requests', { method: 'DELETE', body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  db.state.responses = {};
  db.state.calls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/audit-requests', () => {
  it('is empty before the first request arrived', async () => {
    db.state.responses = { 'searches.select': [ok([])] };
    expect(await (await GET()).json()).toEqual({ businesses: [] });
    expect(db.state.calls.filter((c) => c.table === 'businesses')).toHaveLength(0);
  });

  it("lists the requests with each one's audit and report flattened", async () => {
    db.state.responses = {
      'searches.select': [ok([{ id: 's1' }, { id: 's2' }])],
      'businesses.select': [ok([{ id: 'b1', request: { name: 'Sarah' }, audits: { id: 'a1', ai_reports: { id: 'r1' } } }])],
    };
    const { businesses } = await (await GET()).json();
    expect(businesses).toEqual([{ id: 'b1', request: { name: 'Sarah' }, audit: { id: 'a1' }, ai_report: { id: 'r1' } }]);
    const list = db.state.calls.find((c) => c.table === 'businesses');
    expect(list?.filters).toContainEqual(['in', 'search_id', ['s1', 's2']]);
  });

  it('says so when the list cannot be loaded', async () => {
    db.state.responses = { 'searches.select': [ok([{ id: 's1' }])], 'businesses.select': [{ data: null, error: { message: 'down' } }] };
    expect((await GET()).status).toBe(500);
  });
});

describe('DELETE /api/audit-requests', () => {
  it('refuses anything but a list of ids', async () => {
    for (const body of [{}, { ids: [] }, { ids: ['not-an-id'] }, { ids: Array(501).fill(ID) }]) {
      expect((await remove(body)).status).toBe(400);
    }
    expect(db.state.calls).toHaveLength(0);
  });

  it('removes only requests: the delete is limited to the requests search', async () => {
    db.state.responses = { 'searches.select': [ok([{ id: 's1' }])], 'businesses.delete': [ok([{ id: ID }])] };
    const { json } = await remove({ ids: [ID] });
    expect(json).toEqual({ removed: [ID] });
    const del = db.state.calls.find((c) => c.op === 'delete');
    expect(del?.filters).toEqual([
      ['in', 'search_id', ['s1']],
      ['in', 'id', [ID]],
    ]);
  });
});
