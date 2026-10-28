// Google's terms keep its place details 30 days. Each day the cron blanks the
// details of every business older than that, unless it was added by URL or
// requested (none of that is from Google). It only counts them until the owner
// turns it on.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Result = { data?: unknown; count?: number | null; error: { message: string } | null };
type Call = { table: string; op: string; payload?: unknown; options?: unknown; filters: unknown[][] };

const db = vi.hoisted(() => {
  const state = { responses: {} as Record<string, Result[]>, calls: [] as Call[] };
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    const resolve = (): Promise<Result> => {
      state.calls.push(call);
      const queue = state.responses[`${table}.${call.op}`] ?? [];
      return Promise.resolve((queue.length > 1 ? queue.shift() : queue[0]) ?? { data: null, error: null });
    };
    const chain = {
      select: (_columns?: string, options?: unknown) => {
        if (call.op === 'select') call.options = options;
        return chain;
      },
      update: (payload: unknown, options: unknown) => ((call.op = 'update'), (call.payload = payload), (call.options = options), chain),
      eq: (column: string, value: unknown) => (call.filters.push(['eq', column, value]), chain),
      neq: (column: string, value: unknown) => (call.filters.push(['neq', column, value]), chain),
      lt: (column: string, value: unknown) => (call.filters.push(['lt', column, value]), chain),
      not: (column: string, op: string, value: unknown) => (call.filters.push(['not', column, op, value]), chain),
      then: (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) => resolve().then(onOk, onErr),
    };
    return chain;
  };
  return { state, from };
});
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: { from: db.from } }));

const { erasePlaceData } = await import('@/app/_shared/lib/places/placeDataErase');

const NOW = new Date('2026-11-30T12:00:00.000Z');
const CUTOFF = '2026-10-31T12:00:00.000Z';

beforeEach(() => {
  db.state.calls = [];
  db.state.responses = {
    // The account's "added by URL" search, then the owner's audit requests
    'searches.select': [{ data: [{ id: 'direct-1' }, { id: 'direct-2' }], error: null }, { data: [{ id: 'requests-1' }], error: null }],
  };
});

const businessCall = () => db.state.calls.find((c) => c.table === 'businesses');

describe('erasePlaceData', () => {
  it('only counts the businesses it would blank while it is off', async () => {
    db.state.responses['businesses.select'] = [{ count: 760, error: null }];
    expect(await erasePlaceData(false, NOW)).toEqual({ count: 760 });

    const searches = db.state.calls.filter((c) => c.table === 'searches');
    expect(searches.map((c) => c.filters)).toEqual([
      [['eq', 'niche', 'website audits'], ['eq', 'location', 'added by url']],
      [['eq', 'niche', 'audit requests'], ['eq', 'location', 'devartventures.com']],
    ]);
    expect(businessCall()).toMatchObject({
      op: 'select',
      options: { count: 'exact', head: true },
      filters: [
        ['lt', 'created_at', CUTOFF],
        ['neq', 'name', ''],
        ['not', 'search_id', 'in', '(direct-1,direct-2,requests-1)'],
      ],
    });
  });

  it("blanks Google's details once it's on, keeping the place id, audits and contacts", async () => {
    db.state.responses['businesses.update'] = [{ count: 12, error: null }];
    expect(await erasePlaceData(true, NOW)).toEqual({ count: 12 });
    expect(businessCall()).toMatchObject({
      op: 'update',
      payload: { name: '', address: '', website: null, phone: null, rating: null, review_count: null },
      options: { count: 'exact' },
      filters: [
        ['lt', 'created_at', CUTOFF],
        ['neq', 'name', ''],
        ['not', 'search_id', 'in', '(direct-1,direct-2,requests-1)'],
      ],
    });
  });

  it('needs no exclusion when nobody has added a site by URL', async () => {
    db.state.responses['searches.select'] = [{ data: [], error: null }];
    db.state.responses['businesses.select'] = [{ count: 3, error: null }];
    expect(await erasePlaceData(false, NOW)).toEqual({ count: 3 });
    expect(businessCall()?.filters).toEqual([
      ['lt', 'created_at', CUTOFF],
      ['neq', 'name', ''],
    ]);
  });

  it("touches nothing when it can't tell which searches to leave alone", async () => {
    db.state.responses['searches.select'] = [{ data: null, error: { message: 'timeout' } }];
    expect(await erasePlaceData(true, NOW)).toEqual({ error: 'timeout' });
    expect(businessCall()).toBeUndefined();
  });

  it('says so when the database refuses', async () => {
    db.state.responses['businesses.update'] = [{ count: null, error: { message: 'permission denied' } }];
    expect(await erasePlaceData(true, NOW)).toEqual({ error: 'permission denied' });
  });
});
