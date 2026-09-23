import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/audit/route';
import { runAudit, AuditUnavailableError } from '@/app/_shared/lib/audit/runAudit';
import type { AuditOutcome } from '@/app/_shared/lib/audit/types';

type Result = { data: unknown; error: { code?: string; message: string } | null };

// Chainable fake of the Supabase query builder. Responses are queued per `table.op`
// (the last one repeats); every resolved query is logged with its payload and eq() filters.
const db = vi.hoisted(() => {
  const state = {
    responses: {} as Record<string, Result[]>,
    calls: [] as { table: string; op: string; payload?: unknown; filters: unknown[][] }[],
  };
  const respond = (table: string, op: string, payload: unknown, filters: unknown[][]): Promise<Result> => {
    state.calls.push({ table, op, payload, filters });
    const queue = state.responses[`${table}.${op}`] ?? [];
    return Promise.resolve((queue.length > 1 ? queue.shift() : queue[0]) ?? { data: null, error: null });
  };
  const from = (table: string) => {
    let op = 'select';
    let payload: unknown;
    const filters: unknown[][] = [];
    const resolve = () => respond(table, op, payload, filters);
    const write = (kind: string) => (value?: unknown) => {
      op = kind;
      payload = value;
      return chain;
    };
    const chain = {
      select: () => chain,
      insert: write('insert'),
      update: write('update'),
      delete: write('delete'),
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      single: resolve,
      maybeSingle: resolve,
      then: (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) => resolve().then(onOk, onErr),
    };
    return chain;
  };
  const reset = () => {
    state.responses = {};
    state.calls = [];
  };
  const ops = (table: string, op: string) => state.calls.filter((c) => c.table === table && c.op === op);
  return { state, from, reset, ops };
});

vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));
vi.mock('@/app/_shared/lib/audit/runAudit', () => ({
  AuditUnavailableError: class AuditUnavailableError extends Error {},
  runAudit: vi.fn(),
}));
vi.mock('@/app/_shared/lib/utils/emailFinder', () => ({ findEmail: vi.fn(async () => null) }));

const business = {
  name: 'Smile Dental',
  address: '123 Main St, Springfield, IL 62701, USA',
  phone: '(555) 123-4567',
  website: 'https://smiledental.com',
  email: 'hello@smiledental.com',
  searches: { niche: 'dentist' },
};

const outcome = {
  row: { performance_score: 80, engine_version: 2 },
  email: 'hello@smiledental.com',
} as unknown as AuditOutcome;
const storedAudit = (over: Record<string, unknown> = {}) => ({
  id: 'audit-1',
  business_id: 'biz-1',
  engine_version: 2,
  ...over,
});

const ok = (data: unknown): Result => ({ data, error: null });
const fail = (message: string, code?: string): Result => ({ data: null, error: { message, code } });

function givenDb(responses: Record<string, Result[]>) {
  db.state.responses = { 'businesses.select': [ok(business)], ...responses };
}

async function post(body: Record<string, unknown>) {
  const res = await POST(
    new NextRequest('http://localhost/api/audit', { method: 'POST', body: JSON.stringify(body) })
  );
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  db.reset();
  vi.mocked(runAudit).mockReset().mockResolvedValue(outcome);
  vi.stubEnv('GOOGLE_PAGESPEED_API_KEY', 'test-key');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/audit', () => {
  it('serves a current-engine cached audit without re-running', async () => {
    givenDb({ 'audits.select': [ok(storedAudit())] });
    const { status, json } = await post({ business_id: 'biz-1' });
    expect(status).toBe(200);
    expect(json.audit).toEqual(storedAudit());
    expect(runAudit).not.toHaveBeenCalled();
    expect(db.ops('audits', 'insert')).toHaveLength(0);
    expect(db.ops('audits', 'update')).toHaveLength(0);
  });

  it('re-runs an outdated v1 audit and updates the same row', async () => {
    givenDb({
      'audits.select': [ok(storedAudit({ engine_version: 1 }))],
      'audits.update': [ok(storedAudit({ performance_score: 80 }))],
    });
    const { status, json } = await post({ business_id: 'biz-1' });
    expect(status).toBe(200);
    expect(runAudit).toHaveBeenCalledOnce();
    expect(db.ops('audits', 'update')[0].filters).toEqual([['id', 'audit-1']]);
    expect(db.ops('ai_reports', 'delete')[0].filters).toEqual([['audit_id', 'audit-1']]);
    expect(db.ops('audits', 'insert')).toHaveLength(0);
    expect(json.audit.id).toBe('audit-1');
  });

  it('re-runs a current audit when force is set', async () => {
    givenDb({ 'audits.select': [ok(storedAudit())], 'audits.update': [ok(storedAudit())] });
    const { status } = await post({ business_id: 'biz-1', force: true });
    expect(status).toBe(200);
    expect(runAudit).toHaveBeenCalledOnce();
    expect(db.ops('audits', 'update')).toHaveLength(1);
    expect(db.ops('ai_reports', 'delete')).toHaveLength(1);
  });

  it('inserts a new audit when none exists', async () => {
    givenDb({ 'audits.select': [ok(null)], 'audits.insert': [ok(storedAudit())] });
    const { status, json } = await post({ business_id: 'biz-1' });
    expect(status).toBe(200);
    expect(db.ops('audits', 'insert')[0].payload).toMatchObject({ business_id: 'biz-1', engine_version: 2 });
    expect(db.ops('audits', 'update')).toHaveLength(0);
    expect(json.audit.id).toBe('audit-1');
  });

  it('re-reads the stored row when a concurrent insert wins (23505)', async () => {
    givenDb({
      'audits.select': [ok(null), ok(storedAudit({ id: 'audit-race' }))],
      'audits.insert': [fail('duplicate key', '23505')],
    });
    const { status, json } = await post({ business_id: 'biz-1' });
    expect(status).toBe(200);
    expect(db.ops('audits', 'select')).toHaveLength(2);
    expect(json.audit.id).toBe('audit-race');
  });

  it('returns 502 and stores nothing when the site cannot be audited', async () => {
    givenDb({ 'audits.select': [ok(null)] });
    vi.mocked(runAudit).mockRejectedValue(new AuditUnavailableError('Blocked (403)'));
    const { status, json } = await post({ business_id: 'biz-1' });
    expect(status).toBe(502);
    expect(json.error).toBe("Couldn't audit this site: Blocked (403)");
    expect(db.ops('audits', 'insert')).toHaveLength(0);
    expect(db.ops('audits', 'update')).toHaveLength(0);
  });

  it('returns 503 without auditing when the PageSpeed key is missing', async () => {
    vi.stubEnv('GOOGLE_PAGESPEED_API_KEY', '');
    givenDb({ 'audits.select': [ok(null)] });
    const { status, json } = await post({ business_id: 'biz-1' });
    expect(status).toBe(503);
    expect(json.error).toBe('GOOGLE_PAGESPEED_API_KEY is not configured');
    expect(runAudit).not.toHaveBeenCalled();
  });

  it('returns 500 when the stale AI report cannot be deleted on re-audit', async () => {
    givenDb({
      'audits.select': [ok(storedAudit())],
      'audits.update': [ok(storedAudit())],
      'ai_reports.delete': [fail('permission denied')],
    });
    const { status, json } = await post({ business_id: 'biz-1', force: true });
    expect(status).toBe(500);
    expect(json.error).toBe('Failed to store audit');
  });
});
