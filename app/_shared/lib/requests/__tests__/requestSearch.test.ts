import { describe, it, expect, beforeEach } from 'vitest';
import { requestSearchIds, ensureRequestSearchId } from '@/app/_shared/lib/requests/requestSearch';
import type { Db } from '@/app/_shared/lib/supabase/client';

// Fake database: records the select filters and the insert payload of the searches table
let selectFilters: unknown[][] = [];
let selectResult: { id: string }[] = [];
let insertPayload: unknown = null;

const fakeDb = {
  from: () => {
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        selectFilters.push(['eq', column, value]);
        return chain;
      },
      order: async () => ({ data: selectResult, error: null }),
      insert: (payload: unknown) => {
        insertPayload = payload;
        return { select: () => ({ single: async () => ({ data: { id: 'new-search' }, error: null }) }) };
      },
    };
    return chain;
  },
} as unknown as Db;

beforeEach(() => {
  selectFilters = [];
  selectResult = [{ id: 's1' }];
  insertPayload = null;
});

describe('requestSearchIds', () => {
  it("only uses the owner's requests search, never another user's with the same name", async () => {
    await requestSearchIds(fakeDb, 'owner-1');
    expect(selectFilters).toContainEqual(['eq', 'user_id', 'owner-1']);
  });
});

describe('ensureRequestSearchId', () => {
  it('reuses the first requests search', async () => {
    expect(await ensureRequestSearchId(fakeDb, 'owner-1')).toBe('s1');
    expect(insertPayload).toBeNull();
  });

  it('creates the requests search for the owner', async () => {
    selectResult = [];
    expect(await ensureRequestSearchId(fakeDb, 'owner-1')).toBe('new-search');
    expect(insertPayload).toEqual({ niche: 'audit requests', location: 'devartventures.com', user_id: 'owner-1' });
  });
});
