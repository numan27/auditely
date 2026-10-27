import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/results/route';

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
      maybeSingle: resolve,
      then: (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) => resolve().then(onOk, onErr),
    };
    return chain;
  };
  return { state, from };
});

vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: { from: db.from } }));

const ok = (data: unknown): Result => ({ data, error: null });
const deletes = () => db.state.calls.filter((c) => c.op === 'delete');

async function remove(body: unknown) {
  const res = await DELETE(new NextRequest('http://localhost/api/results', { method: 'DELETE', body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  db.state.responses = {};
  db.state.calls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('DELETE /api/results', () => {
  const SEARCH = '3a7e9c10-2b4d-4e6f-8a1b-9c0d2e4f6a8b';
  const A = '6f1c2f0e-8a52-4a53-9d0f-3c1c6b7e2a11';
  const B = '0b9d7c44-1e2a-4f6b-8c3d-5a4e3f2b1c00';
  const leadSearch = ok({ niche: 'dentists', location: 'Austin, TX' });

  it('removes the given leads, and only from the search they were shown in', async () => {
    db.state.responses = { 'searches.select': [leadSearch], 'businesses.delete': [ok([{ id: A }])] };
    const { status, json } = await remove({ search_id: SEARCH, ids: [A] });
    expect(status).toBe(200);
    expect(json).toEqual({ removed: [A] });
    expect(deletes()).toHaveLength(1);
    expect(deletes()[0].table).toBe('businesses');
    expect(deletes()[0].filters).toEqual([
      ['eq', 'search_id', SEARCH],
      ['in', 'id', [A]],
    ]);
  });

  it('reports only what was really removed', async () => {
    // B belongs to another search: the search_id filter leaves it alone
    db.state.responses = { 'searches.select': [leadSearch], 'businesses.delete': [ok([{ id: A }])] };
    expect((await remove({ search_id: SEARCH, ids: [A, B] })).json).toEqual({ removed: [A] });
  });

  it('refuses a request that names no search or no leads, before touching the database', async () => {
    for (const body of [
      {},
      { ids: [A] },
      { search_id: 'not-an-id', ids: [A] },
      { search_id: SEARCH },
      { search_id: SEARCH, ids: [] },
      { search_id: SEARCH, ids: 'all' },
      { search_id: SEARCH, ids: [A, 7] },
      { search_id: SEARCH, ids: [`${A}' or true`] },
    ]) {
      const { status, json } = await remove(body);
      expect(status, JSON.stringify(body)).toBe(400);
      expect(json.error).toBeTruthy();
    }
    expect(db.state.calls).toHaveLength(0);
  });

  it('refuses more leads than one search holds', async () => {
    const { status } = await remove({ search_id: SEARCH, ids: Array.from({ length: 501 }, () => A) });
    expect(status).toBe(400);
    expect(db.state.calls).toHaveLength(0);
  });

  it('leaves the website-audit and request lists to their own tabs', async () => {
    for (const search of [{ niche: 'website audits', location: 'added by url' }, { niche: 'audit requests', location: 'devartventures.com' }]) {
      db.state.calls = [];
      db.state.responses = { 'searches.select': [ok(search)] };
      const { status } = await remove({ search_id: SEARCH, ids: [A] });
      expect(status, search.niche).toBe(400);
      expect(deletes()).toHaveLength(0);
    }
  });

  it('has nothing to remove from a search that is gone', async () => {
    db.state.responses = { 'searches.select': [ok(null)] };
    const { status, json } = await remove({ search_id: SEARCH, ids: [A] });
    expect(status).toBe(200);
    expect(json).toEqual({ removed: [] });
    expect(deletes()).toHaveLength(0);
  });

  it('says so when the database refuses', async () => {
    db.state.responses = { 'searches.select': [leadSearch], 'businesses.delete': [{ data: null, error: { message: 'boom' } }] };
    const { status, json } = await remove({ search_id: SEARCH, ids: [A] });
    expect(status).toBe(500);
    expect(json.error).toMatch(/remove/i);
  });
});
