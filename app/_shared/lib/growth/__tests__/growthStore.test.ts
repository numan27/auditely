// Reading the owner's numbers: every page of each table, the owner's own account
// left out, and nothing at all when a read fails.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
const tables = vi.hoisted(() => ({ rows: {} as Record<string, Row[]>, failing: null as string | null, calls: [] as string[] }));

// The reads: from(table).select(...).<filters>.order(...).range(from, to)
vi.mock('@/app/_shared/lib/supabase/client', () => {
  const builder = (table: string) => {
    const chain = {
      select: () => chain,
      gte: () => chain,
      in: () => chain,
      not: () => chain,
      order: () => chain,
      range: async (from: number, to: number) => {
        tables.calls.push(`${table} ${from}-${to}`);
        if (tables.failing === table) return { data: null, error: { message: `relation "${table}" does not exist` } };
        return { data: (tables.rows[table] ?? []).slice(from, to + 1), error: null };
      },
    };
    return chain;
  };
  return { serviceDb: { from: builder } };
});

const { growthRows } = await import('@/app/_shared/lib/growth/growthStore');
const NOW = new Date('2026-10-28T12:00:00.000Z');

beforeEach(() => {
  vi.stubEnv('OWNER_EMAIL', 'Owner@Example.com');
  tables.failing = null;
  tables.calls = [];
  tables.rows = {
    profiles: [
      { id: 'owner', email: 'owner@example.com', created_at: '2026-10-20T00:00:00.000Z' },
      { id: 'u1', email: 'sam@acme.studio', created_at: '2026-10-27T00:00:00.000Z' },
    ],
    usage_events: [
      ...Array.from({ length: 2400 }, () => ({ user_id: 'owner', kind: 'audit' })),
      { user_id: 'u1', kind: 'search' },
      { user_id: 'u1', kind: 'audit' },
    ],
    businesses: [{ user_id: 'u1' }],
    subscriptions: [
      { user_id: 'u1', status: 'active', current_period_end: '2026-11-27T00:00:00.000Z' },
      { user_id: 'u2', status: 'canceled', current_period_end: '2026-11-01T00:00:00.000Z' },
    ],
    free_audits: [{ created_at: '2026-10-26T00:00:00.000Z', claimed_by: 'u1' }, { created_at: '2026-10-25T00:00:00.000Z', claimed_by: null }],
  };
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('growthRows', () => {
  it("reads every table into the funnel's rows, leaving out the owner's account", async () => {
    expect(await growthRows(NOW)).toEqual({
      accounts: [{ id: 'u1', createdAt: '2026-10-27T00:00:00.000Z' }],
      searched: ['u1'],
      audited: expect.arrayContaining(['u1']),
      paying: ['u1'],
      emailed: ['u1'],
      freeAudits: [
        { createdAt: '2026-10-26T00:00:00.000Z', kept: true },
        { createdAt: '2026-10-25T00:00:00.000Z', kept: false },
      ],
    });
  });

  it('reads past the first thousand rows', async () => {
    const rows = await growthRows(NOW);
    expect(tables.calls).toEqual(expect.arrayContaining(['usage_events 0-999', 'usage_events 1000-1999', 'usage_events 2000-2999']));
    expect(rows?.audited).toContain('u1');
  });

  it('gives nothing when a table cannot be read, and says which', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    tables.failing = 'usage_events';
    expect(await growthRows(NOW)).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('usage_events'));
  });
});
