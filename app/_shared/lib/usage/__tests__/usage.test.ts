import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Db } from '@/app/_shared/lib/supabase/client';

const rpc = vi.hoisted(() => vi.fn());
const deletes = vi.hoisted(() => [] as unknown[][][]);
// The service client: claim_usage, and the delete a released claim makes
vi.mock('@/app/_shared/lib/supabase/client', () => ({
  serviceDb: {
    rpc,
    from: () => {
      const filters: unknown[][] = [];
      const chain = {
        delete: () => chain,
        eq: (column: string, value: unknown) => (filters.push([column, value]), chain),
        then: (onOk: (r: unknown) => unknown) => (deletes.push(filters), Promise.resolve({ error: null }).then(onOk)),
      };
      return chain;
    },
  },
}));

const { meterFor, usageSummary } = await import('@/app/_shared/lib/usage/usage');

const tester = { id: 'u2', email: 'tester@x.com', isOwner: false };
const owner = { id: 'u1', email: 'owner@x.com', isOwner: true };
const now = () => new Date('2026-10-14T09:00:00Z');
// Bought on Mar 14 at 09:30 UTC, yearly: now() is half an hour before this month's window opens
const subscriber = {
  ...tester,
  subscription: {
    plan: 'pro', interval: 'year', status: 'active', anchor: '2026-03-14T09:30:00.000Z', periodEnd: '2027-03-14T09:30:00.000Z', endsAt: null,
  } as const,
};

const selects: unknown[][] = [];
const filters: unknown[][] = [];

/** The user's client: each head count answers the number given for its kind */
function userDb(counts: Record<string, number>, error: { message: string } | null = null): Db {
  return {
    from: () => {
      let kind = '';
      const chain = {
        select: (...args: unknown[]) => (selects.push(args), chain),
        eq: (column: string, value: unknown) => (filters.push(['eq', column, value]), column === 'kind' && (kind = String(value)), chain),
        gte: (column: string, value: unknown) => (filters.push(['gte', column, value]), chain),
        then: (onOk: (r: unknown) => unknown) => Promise.resolve({ count: error ? null : counts[kind] ?? 0, error }).then(onOk),
      };
      return chain;
    },
  } as unknown as Db;
}

beforeEach(() => {
  vi.stubEnv('PLAN_OVERRIDES', '');
  rpc.mockReset();
  deletes.length = 0;
  selects.length = 0;
  filters.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('meterFor', () => {
  it('never records the owner', async () => {
    const claim = await meterFor(owner, now).claim('search');
    expect(claim.ok).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('claims through claim_usage with the plan limit and the month start', async () => {
    rpc.mockResolvedValue({ data: 'ev-1', error: null });
    const claim = await meterFor(tester, now).claim('audit');
    expect(rpc).toHaveBeenCalledWith('claim_usage', { p_user_id: 'u2', p_kind: 'audit', p_limit: 5, p_since: '2026-10-01T00:00:00.000Z' });
    expect(claim.ok).toBe(true);
  });

  it('refuses at the limit with the spec message and the limit', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await meterFor(tester, now).claim('search')).toEqual({
      ok: false, status: 402, error: "You've used this month's search. You get another on Nov 1.",
      limit: { kind: 'search', plan: 'free', limit: 1, resetsAt: '2026-11-01T00:00:00.000Z' },
    });
  });

  it('refuses a kind the plan never had without asking the database', async () => {
    const meter = meterFor(tester, now);
    expect((await meter.claim('email_lookup')).ok).toBe(false);
    expect(meter.notOnPlan('email_lookup')).toEqual({ kind: 'email_lookup', plan: 'free', limit: 0, resetsAt: '2026-11-01T00:00:00.000Z' });
    expect(meter.notOnPlan('audit')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("counts a subscriber's month from the billing anchor, at the plan's limit", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const claim = await meterFor(subscriber, now).claim('search');
    expect(rpc).toHaveBeenCalledWith('claim_usage', { p_user_id: 'u2', p_kind: 'search', p_limit: 25, p_since: '2026-09-14T09:30:00.000Z' });
    expect(claim).toMatchObject({ ok: false, limit: { plan: 'pro', resetsAt: '2026-10-14T09:30:00.000Z' } });
  });

  it('fails closed with a 503 when the ledger is missing', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function claim_usage does not exist' } });
    expect(await meterFor(tester, now).claim('search')).toEqual({ ok: false, status: 503, error: "Couldn't check this month's allowance. Try again in a minute." });
  });

  it('gives a claim back by deleting its own row', async () => {
    rpc.mockResolvedValue({ data: 'ev-9', error: null });
    const claim = await meterFor(tester, now).claim('audit');
    if (claim.ok) await claim.release();
    expect(deletes).toEqual([[['id', 'ev-9'], ['user_id', 'u2']]]);
  });
});

describe('usageSummary', () => {
  it('counts each limited kind with a head count, never a row list', async () => {
    const summary = await usageSummary(userDb({ search: 1, audit: 3 }), tester, new Date('2026-10-14T09:00:00Z'));
    expect(summary).toEqual({ plan: 'free', resetsAt: '2026-11-01T00:00:00.000Z',
      usage: { search: { used: 1, limit: 1 }, audit: { used: 3, limit: 5 }, email_lookup: { used: 0, limit: 0 } } });
    expect(selects).toEqual([['id', { count: 'exact', head: true }], ['id', { count: 'exact', head: true }]]);
    expect(filters).toContainEqual(['gte', 'created_at', '2026-10-01T00:00:00.000Z']);
    expect(filters).toContainEqual(['eq', 'user_id', 'u2']);
  });

  it("summarises a subscriber's month from the billing anchor", async () => {
    const summary = await usageSummary(userDb({ search: 3 }), subscriber, now());
    expect(summary).toMatchObject({ plan: 'pro', resetsAt: '2026-10-14T09:30:00.000Z', usage: { search: { used: 3, limit: 25 } } });
    expect(filters).toContainEqual(['gte', 'created_at', '2026-09-14T09:30:00.000Z']);
  });

  it('summarises the owner without a query', async () => {
    expect((await usageSummary(userDb({}), owner))?.usage.search).toEqual({ used: 0, limit: null });
    expect(selects).toEqual([]);
  });

  it('answers null when counting fails', async () =>
    expect(await usageSummary(userDb({}, { message: 'relation "usage_events" does not exist' }), tester)).toBeNull());
});
