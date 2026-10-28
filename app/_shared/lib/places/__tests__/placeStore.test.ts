// Saving a search's places, and refreshing a search whose place details are over
// 30 days old: each place Google sends again updates the row it had, so the lead
// keeps its audit, and the new ones are added, all in Google's order. Both work
// before the place-id migration has run.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertPlaces, refreshPlaces, freshBusinesses } from '@/app/_shared/lib/places/placeStore';
import type { Db } from '@/app/_shared/lib/supabase/client';
import type { PlaceResult } from '@/app/_shared/lib/places/types';

type Result = { data: unknown; error: { code?: string; message: string } | null };
type Call = { table: string; op: string; payload?: unknown; columns?: string; options?: unknown; filters: unknown[][] };

const NO_COLUMN_WRITE = { code: 'PGRST204', message: "Could not find the 'place_id' column of 'businesses' in the schema cache" };
const NO_COLUMN_READ = { code: '42703', message: 'column businesses.place_id does not exist' };

// Chainable fake of the Supabase query builder: answers are queued per `table.op`,
// and without the migration any read or write that names place_id fails as PostgREST does
function fakeDb(responses: Record<string, Result[]> = {}, { migrated = true } = {}) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    const resolve = (): Promise<Result> => {
      calls.push(call);
      const named = JSON.stringify(call.payload ?? '') + (call.columns ?? '');
      if (!migrated && named.includes('place_id')) {
        return Promise.resolve({ data: null, error: call.op === 'select' ? NO_COLUMN_READ : NO_COLUMN_WRITE });
      }
      const queue = responses[`${table}.${call.op}`] ?? [];
      return Promise.resolve((queue.length > 1 ? queue.shift() : queue[0]) ?? { data: null, error: null });
    };
    const chain = {
      select: (columns?: string) => {
        if (call.op === 'select') call.columns = columns;
        return chain;
      },
      insert: (payload: unknown) => ((call.op = 'insert'), (call.payload = payload), chain),
      upsert: (payload: unknown, options: unknown) => ((call.op = 'upsert'), (call.payload = payload), (call.options = options), chain),
      update: (payload: unknown) => ((call.op = 'update'), (call.payload = payload), chain),
      eq: (column: string, value: unknown) => (call.filters.push(['eq', column, value]), chain),
      gte: (column: string, value: unknown) => (call.filters.push(['gte', column, value]), chain),
      order: () => chain,
      then: (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) => resolve().then(onOk, onErr),
    };
    return chain;
  };
  return { db: { from } as unknown as Db, calls };
}

const place = (name: string, placeId: string, extra: Partial<PlaceResult> = {}): PlaceResult => ({
  name,
  address: `${name} St, Austin, TX`,
  website: null,
  phone: '+1 512 555 0100',
  rating: 4.5,
  reviewCount: 80,
  placeId,
  ...extra,
});

const START = Date.parse('2026-11-30T12:00:00.000Z');
const at = (i: number) => new Date(START + i).toISOString();

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('insertPlaces', () => {
  it("saves each place with Google's place id, in Google's order", async () => {
    const { db, calls } = fakeDb({ 'businesses.insert': [{ data: [{ id: 'b1' }, { id: 'b2' }], error: null }] });
    const result = await insertPlaces(db, 'search-1', [place('Smile Co', 'p1'), place('Bright Dental', 'p2')], START);

    expect(result).toEqual({ data: [{ id: 'b1' }, { id: 'b2' }], error: null });
    expect(calls[0].payload).toEqual([
      {
        search_id: 'search-1',
        name: 'Smile Co',
        address: 'Smile Co St, Austin, TX',
        website: null,
        phone: '+1 512 555 0100',
        rating: 4.5,
        review_count: 80,
        place_id: 'p1',
        created_at: at(0),
      },
      expect.objectContaining({ name: 'Bright Dental', place_id: 'p2', created_at: at(1) }),
    ]);
  });

  it("saves them without the place id until the migration has run, and says which one to run", async () => {
    const { db, calls } = fakeDb({ 'businesses.insert': [{ data: [{ id: 'b1' }], error: null }] }, { migrated: false });
    const result = await insertPlaces(db, 'search-1', [place('Smile Co', 'p1')], START);

    expect(result.error).toBeNull();
    expect(calls).toHaveLength(2);
    expect(calls[1].payload).toEqual([expect.not.objectContaining({ place_id: expect.anything() })]);
    expect(calls[1].payload).toEqual([expect.objectContaining({ name: 'Smile Co', created_at: at(0) })]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('docs/migrations/2026-11-01-place-data.sql'));
  });

  it('passes any other error back', async () => {
    const { db, calls } = fakeDb({ 'businesses.insert': [{ data: null, error: { message: 'permission denied' } }] });
    const result = await insertPlaces(db, 'search-1', [place('Smile Co', 'p1')], START);
    expect(result.error).toEqual({ message: 'permission denied' });
    expect(calls).toHaveLength(1);
  });
});

describe('refreshPlaces', () => {
  const SAVED = {
    data: [
      { id: 'b-smile', place_id: 'p1', name: 'Smile Co', address: 'old address', website: null },
      { id: 'b-old', place_id: null, name: 'Bright Dental', address: 'Bright Dental St, Austin, TX', website: null },
      { id: 'b-gone', place_id: 'p-closed', name: 'Closed Dental', address: 'x', website: null },
    ],
    error: null,
  };

  it("updates the rows Google sends again, adds the new places, and dates the search afresh", async () => {
    const { db, calls } = fakeDb({ 'businesses.select': [SAVED] });
    const error = await refreshPlaces(
      db,
      'search-old',
      [place('Smile Co', 'p1', { address: 'new address' }), place('New Dental', 'p3'), place('Bright Dental', 'p2')],
      START
    );

    expect(error).toBeNull();
    const [read, upsert, insert, bump] = calls;
    expect(read).toMatchObject({ table: 'businesses', op: 'select', filters: [['eq', 'search_id', 'search-old']] });
    expect(read.columns).toContain('place_id');
    // Matched rows keep their id, so their audits and contacts stay; created_at follows Google's order
    expect(upsert).toMatchObject({ table: 'businesses', op: 'upsert', options: { onConflict: 'id' } });
    expect(upsert.payload).toEqual([
      expect.objectContaining({ id: 'b-smile', search_id: 'search-old', address: 'new address', place_id: 'p1', created_at: at(0) }),
      expect.objectContaining({ id: 'b-old', search_id: 'search-old', name: 'Bright Dental', place_id: 'p2', created_at: at(2) }),
    ]);
    expect(insert).toMatchObject({ table: 'businesses', op: 'insert' });
    expect(insert.payload).toEqual([expect.objectContaining({ search_id: 'search-old', name: 'New Dental', place_id: 'p3', created_at: at(1) })]);
    expect(insert.payload).toEqual([expect.not.objectContaining({ id: expect.anything() })]);
    // The search counts as fresh again; the row Google didn't send stays as it was, hidden
    expect(bump).toMatchObject({ table: 'searches', op: 'update', payload: { created_at: at(0) }, filters: [['eq', 'id', 'search-old']] });
    expect(calls).toHaveLength(4);
  });

  it('skips the writes it has nothing for', async () => {
    const { db, calls } = fakeDb({ 'businesses.select': [SAVED] });
    expect(await refreshPlaces(db, 'search-old', [place('Brand New', 'p9')], START)).toBeNull();
    expect(calls.map((c) => c.op)).toEqual(['select', 'insert', 'update']);
  });

  it('matches by website or name and address until the migration has run', async () => {
    const { db, calls } = fakeDb(
      { 'businesses.select': [{ data: [{ id: 'b-old', name: 'Bright Dental', address: 'Bright Dental St, Austin, TX', website: null }], error: null }] },
      { migrated: false }
    );
    expect(await refreshPlaces(db, 'search-old', [place('Bright Dental', 'p2')], START)).toBeNull();

    const upserts = calls.filter((c) => c.op === 'upsert');
    expect(upserts.at(-1)?.payload).toEqual([expect.objectContaining({ id: 'b-old', name: 'Bright Dental', created_at: at(0) })]);
    expect(upserts.at(-1)?.payload).toEqual([expect.not.objectContaining({ place_id: expect.anything() })]);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(1);
  });

  it("stops at the first write that fails, and leaves the search's date alone", async () => {
    const { db, calls } = fakeDb({ 'businesses.select': [SAVED], 'businesses.upsert': [{ data: null, error: { message: 'upsert failed' } }] });
    expect(await refreshPlaces(db, 'search-old', [place('Smile Co', 'p1'), place('New Dental', 'p3')], START)).toBe('upsert failed');
    expect(calls.map((c) => c.op)).toEqual(['select', 'upsert']);
  });

  it("says so when the saved rows can't be read", async () => {
    const { db, calls } = fakeDb({ 'businesses.select': [{ data: null, error: { message: 'read failed' } }] });
    expect(await refreshPlaces(db, 'search-old', [place('Smile Co', 'p1')], START)).toBe('read failed');
    expect(calls).toHaveLength(1);
  });
});

describe('freshBusinesses', () => {
  it("loads a search's leads under 30 days old, with their audits, among the account's own", async () => {
    const rows = [{ id: 'b1', audits: null }];
    const { db, calls } = fakeDb({ 'businesses.select': [{ data: rows, error: null }] });
    const result = await freshBusinesses(db, 'search-1', 'user-2', new Date(START));

    expect(result).toEqual({ data: rows, error: null });
    expect(calls[0].columns).toBe('*, audits (*, ai_reports (*))');
    expect(calls[0].filters).toEqual([
      ['eq', 'search_id', 'search-1'],
      ['eq', 'user_id', 'user-2'],
      ['gte', 'created_at', '2026-10-31T12:00:00.000Z'],
    ]);
  });
});
