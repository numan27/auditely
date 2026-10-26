import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

type Result = { data: unknown; error: { message: string; code?: string } | null };

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
      select: () => chain,
      insert: (value: unknown) => ((op = 'insert'), (payload = value), chain),
      eq: (column: string, value: unknown) => (filters.push(['eq', column, value]), chain),
      order: () => chain,
      limit: () => chain,
      single: resolve,
      maybeSingle: resolve,
      then: (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) => resolve().then(onOk, onErr),
    };
    return chain;
  };
  return { state, from };
});

// The work the route leaves for after the response, run by the test when it wants
const background = vi.hoisted(() => ({ tasks: [] as (() => Promise<unknown> | unknown)[] }));
const audits = vi.hoisted(() => ({ auditBusiness: vi.fn(), generateAiReport: vi.fn() }));

vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => background.tasks.push(task),
}));
vi.mock('@/app/_shared/lib/audit/auditBusiness', () => ({ auditBusiness: audits.auditBusiness }));
vi.mock('@/app/_shared/lib/audit/generateAiReport', () => ({ generateAiReport: audits.generateAiReport }));

const { POST } = await import('@/app/api/inbound/audit-request/route');

const SECRET = 's'.repeat(64);
const ok = (data: unknown): Result => ({ data, error: null });
const inserts = (table: string) => db.state.calls.filter((c) => c.table === table && c.op === 'insert');
const request = (over: Record<string, unknown> = {}) => ({
  id: 'req-1',
  name: 'Sarah Jones',
  email: 'sarah@smiledental.com',
  website: 'smiledental.com',
  businessType: 'Healthcare',
  mainConcern: 'Slow website',
  requestedAt: '2026-10-27T09:14:00.000Z',
  ...over,
});

async function send(body: unknown, authorization: string | null = `Bearer ${SECRET}`) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authorization) headers.authorization = authorization;
  const res = await POST(
    new NextRequest('http://localhost/api/inbound/audit-request', { method: 'POST', headers, body: JSON.stringify(body) })
  );
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  vi.stubEnv('AUDITELY_INBOUND_SECRET', SECRET);
  db.state.responses = {};
  db.state.calls = [];
  background.tasks = [];
  audits.auditBusiness.mockReset();
  audits.generateAiReport.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/inbound/audit-request', () => {
  it('refuses everything while the secret is not set', async () => {
    vi.stubEnv('AUDITELY_INBOUND_SECRET', '');
    const { status } = await send(request());
    expect(status).toBe(503);
    expect(db.state.calls).toHaveLength(0);
  });

  it('refuses a caller without the secret, before reading anything', async () => {
    expect((await send(request(), null)).status).toBe(401);
    expect((await send(request(), 'Bearer wrong')).status).toBe(401);
    expect(db.state.calls).toHaveLength(0);
  });

  it('refuses a request that is not a valid audit request', async () => {
    const { status, json } = await send(request({ email: 'nope' }));
    expect(status).toBe(400);
    expect(json.error).toMatch(/email/);
    expect(db.state.calls).toHaveLength(0);
  });

  it('stores a new request under the requests search, then audits and summarises it after answering', async () => {
    db.state.responses = {
      'searches.select': [ok([])],
      'searches.insert': [ok({ id: 'requests' })],
      'businesses.select': [ok(null)],
      'businesses.insert': [ok({ id: 'b1' })],
    };
    audits.auditBusiness.mockResolvedValue({ ok: true, audit: { id: 'a1' }, email: 'sarah@smiledental.com' });
    audits.generateAiReport.mockResolvedValue({ ok: true, ai_report: { id: 'r1' } });

    const { status, json } = await send(request());
    expect(status).toBe(201);
    expect(json).toEqual({ id: 'b1', existing: false });
    expect(inserts('searches')[0].payload).toEqual({ niche: 'audit requests', location: 'devartventures.com' });
    expect(inserts('businesses')[0].payload).toEqual({
      search_id: 'requests',
      name: 'smiledental.com',
      address: '',
      website: 'https://smiledental.com',
      email: 'sarah@smiledental.com',
      request: {
        source_id: 'req-1',
        name: 'Sarah Jones',
        business_type: 'Healthcare',
        main_concern: 'Slow website',
        requested_at: '2026-10-27T09:14:00.000Z',
      },
    });

    // Nothing is audited until the response has gone
    expect(audits.auditBusiness).not.toHaveBeenCalled();
    expect(background.tasks).toHaveLength(1);
    await background.tasks[0]();
    expect(audits.auditBusiness).toHaveBeenCalledWith('b1');
    expect(audits.generateAiReport).toHaveBeenCalledWith('a1');
  });

  it('skips the summary when the audit fails: the card offers to run it', async () => {
    db.state.responses = {
      'searches.select': [ok([{ id: 'requests' }])],
      'businesses.select': [ok(null)],
      'businesses.insert': [ok({ id: 'b1' })],
    };
    audits.auditBusiness.mockResolvedValue({ ok: false, status: 502, error: "Couldn't audit this site" });
    await send(request());
    await background.tasks[0]();
    expect(audits.generateAiReport).not.toHaveBeenCalled();
    expect(inserts('searches')).toHaveLength(0);
  });

  it('stores a request sent twice once, and audits it once', async () => {
    db.state.responses = {
      'searches.select': [ok([{ id: 'requests' }])],
      'businesses.select': [ok({ id: 'b1' })],
    };
    const { status, json } = await send(request());
    expect(status).toBe(200);
    expect(json).toEqual({ id: 'b1', existing: true });
    expect(inserts('businesses')).toHaveLength(0);
    expect(background.tasks).toHaveLength(0);
    const lookup = db.state.calls.find((c) => c.table === 'businesses' && c.op === 'select');
    expect(lookup?.filters).toContainEqual(['eq', 'request->>source_id', 'req-1']);
  });

  it('answers with the stored request when the same one arrived twice at once', async () => {
    db.state.responses = {
      'searches.select': [ok([{ id: 'requests' }])],
      'businesses.select': [ok(null), ok({ id: 'b-other' })],
      'businesses.insert': [{ data: null, error: { message: 'duplicate key', code: '23505' } }],
    };
    const { status, json } = await send(request());
    expect(status).toBe(200);
    expect(json).toEqual({ id: 'b-other', existing: true });
    expect(background.tasks).toHaveLength(0);
  });

  it('points at the migration when the request column is missing', async () => {
    db.state.responses = {
      'searches.select': [ok([{ id: 'requests' }])],
      'businesses.select': [ok(null)],
      'businesses.insert': [{ data: null, error: { message: "Could not find the 'request' column of 'businesses'" } }],
    };
    const { status } = await send(request());
    expect(status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('2026-10-27-audit-requests.sql'));
  });
});
