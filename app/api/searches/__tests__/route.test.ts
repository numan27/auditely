import { describe, it, expect, vi, beforeEach } from 'vitest';

type Result = { data: unknown; error: { message: string } | null };

// Chainable fake of the Supabase query builder: every query records its filters
const db = vi.hoisted(() => {
  const state = {
    response: { data: null, error: null } as Result,
    calls: [] as { table: string; filters: unknown[][] }[],
  };
  const from = (table: string) => {
    const filters: unknown[][] = [];
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => (filters.push(['eq', column, value]), chain),
      gte: (column: string, value: unknown) => (filters.push(['gte', column, value]), chain),
      order: () => chain,
      then: (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) => {
        state.calls.push({ table, filters });
        return Promise.resolve(state.response).then(onOk, onErr);
      },
    };
    return chain;
  };
  return { state, from };
});

const session = vi.hoisted(() => ({ current: null as unknown }));
// The route runs as the signed-in user: the service client must stay unused
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
}));

const { GET } = await import('@/app/api/searches/route');

const daysAgo = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

beforeEach(() => {
  session.current = { db: { from: db.from }, account: { id: 'user-2', email: 'tester@example.com', isOwner: false } };
  db.state.response = { data: null, error: null };
  db.state.calls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/searches', () => {
  it("lists this account's own searches, not just what Row Level Security lets through", async () => {
    const created = daysAgo(1);
    db.state.response = {
      data: [{ id: 's1', niche: 'dentists', location: 'austin', created_at: created, businesses: [{ count: 4 }], fresh: [{ count: 4 }] }],
      error: null,
    };
    const res = await GET();
    expect(await res.json()).toEqual({
      searches: [{ id: 's1', niche: 'dentists', location: 'austin', created_at: created, business_count: 4, expired: false }],
    });
    expect(db.state.calls).toEqual([
      { table: 'searches', filters: [['eq', 'user_id', 'user-2'], ['gte', 'fresh.created_at', expect.any(String)]] },
    ]);
  });

  // Google's terms keep its place details 30 days
  it('marks a search over 30 days old, with the number of leads it had', async () => {
    db.state.response = {
      data: [{ id: 's1', niche: 'dentists', location: 'austin', created_at: daysAgo(31), businesses: [{ count: 5 }], fresh: [{ count: 0 }] }],
      error: null,
    };
    expect((await (await GET()).json()).searches[0]).toMatchObject({ business_count: 5, expired: true });
  });

  it('counts only the leads of a refreshed search that Google sent again', async () => {
    db.state.response = {
      data: [{ id: 's1', niche: 'dentists', location: 'austin', created_at: daysAgo(2), businesses: [{ count: 6 }], fresh: [{ count: 4 }] }],
      error: null,
    };
    expect((await (await GET()).json()).searches[0]).toMatchObject({ business_count: 4, expired: false });
  });

  it('leaves out the websites added by URL and the audit requests: they have their own tabs', async () => {
    db.state.response = {
      data: [
        { id: 'direct', niche: 'website audits', location: 'added by url', created_at: '', businesses: [{ count: 2 }] },
        { id: 'requests', niche: 'audit requests', location: 'devartventures.com', created_at: '', businesses: [{ count: 1 }] },
      ],
      error: null,
    };
    expect(await (await GET()).json()).toEqual({ searches: [] });
  });

  it('says so when the database refuses', async () => {
    db.state.response = { data: null, error: { message: 'boom' } };
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Couldn't load your saved searches. Try again in a minute." });
  });
});
