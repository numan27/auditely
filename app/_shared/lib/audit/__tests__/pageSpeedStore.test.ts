import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pageSpeedStore } from '@/app/_shared/lib/audit/pageSpeedStore';
import type { CachedPageSpeed } from '@/app/_shared/lib/audit/pageSpeedCache';

// Minimal in-memory Supabase: select().eq().eq().maybeSingle() and upsert() on the
// table's primary key (url_key, strategy). `failWith` makes every query error.
const db = vi.hoisted(() => {
  const state = { rows: [] as Record<string, unknown>[], failWith: null as string | null };
  const from = (table: string) => {
    if (table !== 'pagespeed_cache') throw new Error(`unexpected table ${table}`);
    const filters: [string, unknown][] = [];
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return chain;
      },
      maybeSingle: async () =>
        state.failWith
          ? { data: null, error: { message: state.failWith } }
          : { data: state.rows.find((r) => filters.every(([c, v]) => r[c] === v)) ?? null, error: null },
      upsert: async (row: Record<string, unknown>) => {
        if (state.failWith) return { error: { message: state.failWith } };
        state.rows = state.rows.filter((r) => r.url_key !== row.url_key || r.strategy !== row.strategy).concat(row);
        return { error: null };
      },
    };
    return chain;
  };
  return { state, from };
});

vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: { from: db.from } }));

const entry: CachedPageSpeed = {
  summary: { categories: { performance: { score: 0.4, title: 'Performance' } }, keyAudits: {} },
  isOnHttps: true,
  engineVersion: 2,
  fetchedAt: '2026-09-20T12:00:00.000Z',
};

beforeEach(() => {
  db.state.rows = [];
  db.state.failWith = null;
});

describe('pageSpeedStore', () => {
  it('reads back what it stored, per website and strategy', async () => {
    await pageSpeedStore.put('smiledental.com', 'mobile', entry);
    expect(await pageSpeedStore.get('smiledental.com', 'mobile')).toEqual(entry);
    expect(await pageSpeedStore.get('smiledental.com', 'desktop')).toBeNull();
    expect(await pageSpeedStore.get('otherdental.com', 'mobile')).toBeNull();
  });

  it('replaces the stored result for the same website and strategy', async () => {
    await pageSpeedStore.put('smiledental.com', 'mobile', entry);
    await pageSpeedStore.put('smiledental.com', 'mobile', { ...entry, fetchedAt: '2026-09-30T12:00:00.000Z' });
    expect(db.state.rows).toHaveLength(1);
    expect((await pageSpeedStore.get('smiledental.com', 'mobile'))?.fetchedAt).toBe('2026-09-30T12:00:00.000Z');
  });

  it('throws database errors so the cache can fall back to running PageSpeed', async () => {
    db.state.failWith = 'relation "pagespeed_cache" does not exist';
    await expect(pageSpeedStore.get('smiledental.com', 'mobile')).rejects.toThrow('pagespeed_cache');
    await expect(pageSpeedStore.put('smiledental.com', 'mobile', entry)).rejects.toThrow('pagespeed_cache');
  });
});
