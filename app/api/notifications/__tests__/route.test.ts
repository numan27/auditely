import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

// Chainable fake of the Supabase query builder; responses are queued per `table.op`
const db = vi.hoisted(() => {
  const state = {
    responses: {} as Record<string, Result[]>,
    calls: [] as { table: string; op: string; payload?: unknown; filters: unknown[][] }[],
  };
  const from = (table: string) => {
    let op = 'select';
    let payload: unknown;
    const filters: unknown[][] = [];
    const resolve = (): Promise<Result> => {
      state.calls.push({ table, op, payload, filters });
      const queue = state.responses[`${table}.${op}`] ?? [];
      return Promise.resolve((queue.length > 1 ? queue.shift() : queue[0]) ?? { data: null, error: null });
    };
    const chain = {
      select: (_columns?: string, options?: { head?: boolean }) => (options?.head && (op = 'count'), chain),
      update: (value: unknown) => ((op = 'update'), (payload = value), chain),
      upsert: (value: unknown) => ((op = 'upsert'), (payload = value), chain),
      eq: (column: string, value: unknown) => (filters.push(['eq', column, value]), chain),
      in: (column: string, values: unknown) => (filters.push(['in', column, values]), chain),
      is: (column: string, value: unknown) => (filters.push(['is', column, value]), chain),
      not: (column: string, operator: string, value: unknown) => (filters.push(['not', column, operator, value]), chain),
      order: () => chain,
      limit: () => chain,
      maybeSingle: resolve,
      then: (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) => resolve().then(onOk, onErr),
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
  ownerUserId: async () => 'owner-1',
}));

const { GET, PATCH, POST } = await import('@/app/api/notifications/route');

const ok = (data: unknown, count?: number): Result => ({ data, error: null, count });
const MISSING = { data: null, error: { message: "Could not find the table 'public.notifications'", code: 'PGRST205' } };
const SEARCH = '3a7e9c10-2b4d-4e6f-8a1b-9c0d2e4f6a8b';
const N1 = '6f1c2f0e-8a52-4a53-9d0f-3c1c6b7e2a11';
const calls = (table: string, op: string) => db.state.calls.filter((c) => c.table === table && c.op === op);
const upserted = () => calls('notifications', 'upsert').flatMap((c) => c.payload as { kind: string; dedupe_key: string; title: string }[]);

const requestRow = (id: string, requestedAt: string, emailedAt: string | null = null) => ({
  id,
  name: `${id}.com`,
  emailed_at: emailedAt,
  request: { name: `Owner ${id}`, requested_at: requestedAt },
});

// Signed in, but not as the owner; the client records any query it is asked for
function signInAsMember() {
  const from = vi.fn(db.from);
  session.current = { db: { from }, account: { id: 'user-2', email: 'tester@example.com', isOwner: false } };
  return from;
}

async function call(handler: (req: NextRequest) => Promise<Response>, method: string, body?: unknown, query = '') {
  const res = await handler(
    new NextRequest(`http://localhost/api/notifications${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })
  );
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  session.current = { db: { from: db.from }, account: { id: 'owner-1', email: 'owner@example.com', isOwner: true } };
  db.state.responses = {};
  db.state.calls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // Wednesday, Oct 28 2026, 15:00 UTC: 11:00 in New York, 08:00 in Los Angeles
  vi.useFakeTimers({ now: new Date('2026-10-28T15:00:00Z'), toFake: ['Date'] });
});
afterEach(() => vi.useRealTimers());

describe('GET /api/notifications', () => {
  it('lists the latest notifications with the unread count', async () => {
    const list = [{ id: N1, kind: 'request_new', title: 'New audit request from Sarah', read_at: null }];
    db.state.responses = { 'searches.select': [ok([])], 'notifications.select': [ok(list)], 'notifications.count': [ok(null, 1)] };
    const { status, json } = await call(GET, 'GET');
    expect(status).toBe(200);
    expect(json).toEqual({ notifications: list, unread: 1 });
  });

  it("reminds of the replies due today and overdue on the viewer's calendar, not the ones answered", async () => {
    db.state.responses = {
      'searches.select': [ok([{ id: 'requests' }])],
      'businesses.select': [
        ok([
          requestRow('due', '2026-10-27T14:00:00Z'), // Tuesday: due Wednesday, today
          requestRow('late', '2026-10-26T14:00:00Z'), // Monday: due Tuesday
          requestRow('later', '2026-10-28T13:00:00Z'), // today: due tomorrow
          requestRow('answered', '2026-10-26T14:00:00Z', '2026-10-27T10:00:00Z'),
        ]),
      ],
      'notifications.select': [ok([]), ok([])],
      'notifications.count': [ok(null, 0)],
    };
    await call(GET, 'GET', undefined, '?tz=America/New_York');
    expect(upserted().map((n) => n.dedupe_key)).toEqual(['request_due:due', 'request_overdue:late']);
    expect(upserted()[0].title).toBe('Reply to Owner due today');
    expect(upserted()[1]).toMatchObject({ title: 'Reply to Owner late is overdue', body: 'The free audit of late.com was due a reply on Tue, Oct 27.' });
  });

  it('counts days in the time zone it is given', async () => {
    // 02:00 UTC on Wednesday is still Tuesday evening in Los Angeles: due Wednesday, not yet today there
    vi.setSystemTime(new Date('2026-10-28T02:00:00Z'));
    db.state.responses = {
      'searches.select': [ok([{ id: 'requests' }])],
      'businesses.select': [ok([requestRow('due', '2026-10-27T20:00:00Z')])],
    };
    await call(GET, 'GET', undefined, '?tz=America/Los_Angeles');
    expect(upserted()).toEqual([]);
    await call(GET, 'GET', undefined, '?tz=UTC');
    expect(upserted().map((n) => n.kind)).toEqual(['request_due']);
  });

  it('marks read what no longer needs doing: an answered request, and "reply today" once it is overdue', async () => {
    db.state.responses = {
      'searches.select': [ok([{ id: 'requests' }])],
      'businesses.select': [
        ok([requestRow('answered', '2026-10-26T14:00:00Z', '2026-10-27T10:00:00Z'), requestRow('late', '2026-10-26T14:00:00Z')]),
      ],
      'notifications.select': [
        ok([
          { id: 'n-answered', kind: 'request_new', business_id: 'answered' },
          { id: 'n-late-due', kind: 'request_due', business_id: 'late' },
          { id: 'n-late-new', kind: 'request_new', business_id: 'late' },
        ]),
        ok([]),
      ],
      'notifications.count': [ok(null, 0)],
    };
    await call(GET, 'GET');
    const [update] = calls('notifications', 'update');
    expect(update.filters).toContainEqual(['in', 'id', ['n-answered', 'n-late-due']]);
    // Only the owner's own unread notifications are looked through
    expect(calls('notifications', 'select')[0].filters).toContainEqual(['eq', 'user_id', 'owner-1']);
  });

  it('ignores a time zone it does not know', async () => {
    db.state.responses = { 'searches.select': [ok([])], 'notifications.select': [ok([])], 'notifications.count': [ok(null, 0)] };
    const { status } = await call(GET, 'GET', undefined, '?tz=Mars/Olympus');
    expect(status).toBe(200);
  });

  it("lists another account's own notifications without looking for audit requests", async () => {
    const from = signInAsMember();
    const list = [{ id: N1, kind: 'bulk_done', title: '"Audit all" finished: Dentists in Austin', read_at: null }];
    db.state.responses = { 'notifications.select': [ok(list)], 'notifications.count': [ok(null, 1)] };
    const { status, json } = await call(GET, 'GET', undefined, '?tz=America/New_York');
    expect(status).toBe(200);
    expect(json).toEqual({ notifications: list, unread: 1 });
    expect(from.mock.calls.map(([table]) => table)).toEqual(['notifications', 'notifications']);
    expect(calls('businesses', 'select')).toHaveLength(0);
    expect(upserted()).toEqual([]);
  });

  it("lists and counts this account's own notifications, not just what Row Level Security lets through", async () => {
    signInAsMember();
    db.state.responses = { 'notifications.select': [ok([])], 'notifications.count': [ok(null, 0)] };
    await call(GET, 'GET');
    expect(calls('notifications', 'select').map((c) => c.filters)).toEqual([[['eq', 'user_id', 'user-2']]]);
    expect(calls('notifications', 'count').map((c) => c.filters)).toEqual([
      [
        ['eq', 'user_id', 'user-2'],
        ['is', 'read_at', null],
      ],
    ]);
  });

  it('says the migration is needed instead of failing while the table is missing', async () => {
    db.state.responses = { 'searches.select': [ok([])], 'notifications.select': [MISSING], 'notifications.count': [MISSING] };
    const { status, json } = await call(GET, 'GET');
    expect(status).toBe(200);
    expect(json).toEqual({ notifications: [], unread: 0, setupNeeded: true });
  });
});

describe('PATCH /api/notifications', () => {
  it("marks the given notifications read, among this account's own", async () => {
    signInAsMember();
    const { status } = await call(PATCH, 'PATCH', { ids: [N1] });
    expect(status).toBe(200);
    const [update] = calls('notifications', 'update');
    expect(update.filters).toEqual([
      ['eq', 'user_id', 'user-2'],
      ['is', 'read_at', null],
      ['in', 'id', [N1]],
    ]);
  });

  it("marks all of this account's own read", async () => {
    signInAsMember();
    await call(PATCH, 'PATCH', { all: true });
    expect(calls('notifications', 'update')[0].filters).toEqual([
      ['eq', 'user_id', 'user-2'],
      ['is', 'read_at', null],
    ]);
  });

  it('refuses ids that are not ids', async () => {
    expect((await call(PATCH, 'PATCH', { ids: ['1; drop'] })).status).toBe(400);
    expect((await call(PATCH, 'PATCH', {})).status).toBe(400);
    expect(calls('notifications', 'update')).toHaveLength(0);
  });
});

describe('POST /api/notifications', () => {
  it('records a finished "Audit all" run with its search', async () => {
    db.state.responses = { 'searches.select': [ok({ niche: 'dentists', location: 'austin, tx, usa' })] };
    const { status } = await call(POST, 'POST', { kind: 'bulk_done', search_id: SEARCH, audited: 18, failed: 2 });
    expect(status).toBe(201);
    expect(upserted()).toEqual([
      expect.objectContaining({
        kind: 'bulk_done',
        title: '"Audit all" finished: Dentists in Austin, TX, USA',
        body: '18 websites audited, 2 failed. Run "Audit all" again to retry them.',
        search_id: SEARCH,
        dedupe_key: null,
        user_id: 'owner-1',
      }),
    ]);
  });

  it('records the run for whoever ran it, owner or not', async () => {
    signInAsMember();
    db.state.responses = { 'searches.select': [ok({ niche: 'dentists', location: 'austin, tx, usa' })] };
    const { status } = await call(POST, 'POST', { kind: 'bulk_done', search_id: SEARCH, audited: 3, failed: 0 });
    expect(status).toBe(201);
    expect(upserted()).toEqual([expect.objectContaining({ kind: 'bulk_done', user_id: 'user-2' })]);
  });

  it('refuses anything else', async () => {
    expect((await call(POST, 'POST', { kind: 'request_new', search_id: SEARCH, audited: 1, failed: 0 })).status).toBe(400);
    expect((await call(POST, 'POST', { kind: 'bulk_done', search_id: SEARCH, audited: 0, failed: 0 })).status).toBe(400);
    expect((await call(POST, 'POST', { kind: 'bulk_done', search_id: SEARCH, audited: -1, failed: 2 })).status).toBe(400);
    expect(upserted()).toEqual([]);
  });

  it('answers 404 for a search that is gone', async () => {
    db.state.responses = { 'searches.select': [ok(null)] };
    expect((await call(POST, 'POST', { kind: 'bulk_done', search_id: SEARCH, audited: 3, failed: 0 })).status).toBe(404);
  });
});
