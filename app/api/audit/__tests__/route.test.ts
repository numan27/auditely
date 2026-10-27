import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/audit/route';
import { runAudit, AuditUnavailableError } from '@/app/_shared/lib/audit/runAudit';
import type { AuditOutcome } from '@/app/_shared/lib/audit/types';
import { pageSpeedStore } from '@/app/_shared/lib/audit/pageSpeedStore';
import { findEmail } from '@/app/_shared/lib/utils/emailFinder';

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

const session = vi.hoisted(() => ({ current: null as unknown }));
// The route runs as the signed-in user: the service client must stay unused
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
  ownerUserId: async () => 'owner-1',
}));
vi.mock('@/app/_shared/lib/audit/runAudit', () => ({
  AuditUnavailableError: class AuditUnavailableError extends Error {},
  runAudit: vi.fn(),
}));
vi.mock('@/app/_shared/lib/utils/emailFinder', () => ({ findEmail: vi.fn(async () => null) }));
// Each account's meter; refusal() stays real
const meter = vi.hoisted(() => ({ claim: vi.fn(), release: vi.fn() }));
vi.mock('@/app/_shared/lib/usage/usage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/usage/usage')>()),
  meterFor: () => ({ claim: meter.claim, notOnPlan: () => null }),
}));

const freeAuditLimit = { kind: 'audit', plan: 'free', limit: 5, resetsAt: '2026-11-01T00:00:00.000Z' };

const business = {
  name: 'Smile Dental',
  address: '123 Main St, Springfield, IL 62701, USA',
  phone: '(555) 123-4567',
  website: 'https://smiledental.com',
  email: 'hello@smiledental.com',
  searches: { niche: 'dentist', location: 'springfield' },
};

const outcome = {
  row: { performance_score: 80, engine_version: 2 },
  email: 'hello@smiledental.com',
} as unknown as AuditOutcome;
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const RECENTLY = daysAgo(3);
const storedAudit = (over: Record<string, unknown> = {}) => ({
  id: 'audit-1',
  business_id: 'biz-1',
  engine_version: 2,
  created_at: RECENTLY,
  checks: {},
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
  session.current = { db: { from: db.from }, account: { id: 'owner-1', email: 'owner@example.com', isOwner: true } };
  db.reset();
  vi.mocked(runAudit).mockReset().mockResolvedValue(outcome);
  meter.release.mockReset().mockResolvedValue(undefined);
  meter.claim.mockReset().mockResolvedValue({ ok: true, release: meter.release });
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

  it('re-runs an audit older than 30 days and updates the same row', async () => {
    givenDb({
      'audits.select': [ok(storedAudit({ created_at: daysAgo(31) }))],
      'audits.update': [ok(storedAudit())],
    });
    const { status } = await post({ business_id: 'biz-1' });
    expect(status).toBe(200);
    expect(runAudit).toHaveBeenCalledOnce();
    expect(db.ops('audits', 'update')[0].filters).toEqual([['id', 'audit-1']]);
    expect(db.ops('audits', 'insert')).toHaveLength(0);
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

  it('passes the listing (name, phone, niche) for a business found by search', async () => {
    givenDb({ 'audits.select': [ok(null)], 'audits.insert': [ok(storedAudit())] });
    await post({ business_id: 'biz-1' });
    expect(vi.mocked(runAudit).mock.calls[0][0]).toMatchObject({ name: 'Smile Dental', phone: '(555) 123-4567', niche: 'dentist' });
  });

  it('lets a first audit reuse cached PageSpeed results, but not a Re-audit', async () => {
    givenDb({ 'audits.select': [ok(null)], 'audits.insert': [ok(storedAudit())] });
    await post({ business_id: 'biz-1' });
    expect(vi.mocked(runAudit).mock.calls[0][0]).toMatchObject({ refreshPageSpeed: false });
    expect(vi.mocked(runAudit).mock.calls[0][1]).toEqual({ pageSpeedStore });

    givenDb({ 'audits.select': [ok(storedAudit())], 'audits.update': [ok(storedAudit())] });
    await post({ business_id: 'biz-1', force: true });
    expect(vi.mocked(runAudit).mock.calls[1][0]).toMatchObject({ refreshPageSpeed: true });
  });

  it("hands the audit's key pages to the email finder", async () => {
    givenDb({
      'businesses.select': [ok({ ...business, email: null })],
      'audits.select': [ok(null)],
      'audits.insert': [ok(storedAudit())],
    });
    await post({ business_id: 'biz-1' });
    const pages = [{ url: 'https://smiledental.com/contact', html: '<p>office@smiledental.com</p>' }];
    await vi.mocked(runAudit).mock.calls[0][0].discoverEmail?.('<p>home</p>', pages);
    expect(findEmail).toHaveBeenCalledWith('https://smiledental.com', { homepageHtml: '<p>home</p>', pages });
  });

  it('audits a site added by URL without listing data to compare against', async () => {
    givenDb({
      'businesses.select': [ok({ ...business, name: 'smiledental.com', searches: { niche: 'website audits', location: 'added by url' } })],
      'audits.select': [ok(null)],
      'audits.insert': [ok(storedAudit())],
    });
    await post({ business_id: 'biz-1' });
    expect(vi.mocked(runAudit).mock.calls[0][0]).toMatchObject({ name: '', phone: null, niche: null });
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

  describe('against the plan', () => {
    it('serves a cached audit without claiming one', async () => {
      givenDb({ 'audits.select': [ok(storedAudit())] });
      const { status } = await post({ business_id: 'biz-1' });
      expect(status).toBe(200);
      expect(meter.claim).not.toHaveBeenCalled();
    });

    it('claims an audit before running it, a Re-audit too', async () => {
      givenDb({ 'audits.select': [ok(storedAudit())], 'audits.update': [ok(storedAudit())] });
      const { status } = await post({ business_id: 'biz-1', force: true });
      expect(status).toBe(200);
      expect(meter.claim).toHaveBeenCalledOnce();
      expect(meter.claim).toHaveBeenCalledWith('audit');
      expect(meter.claim.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(runAudit).mock.invocationCallOrder[0]);
      expect(meter.release).not.toHaveBeenCalled();
    });

    it('refuses at the limit without running the audit', async () => {
      givenDb({ 'audits.select': [ok(null)] });
      meter.claim.mockResolvedValue({ ok: false, status: 402, error: "You've used your 5 audits this month. They reset on Nov 1.", limit: freeAuditLimit });
      const { status, json } = await post({ business_id: 'biz-1' });
      expect(status).toBe(402);
      expect(json).toEqual({ error: "You've used your 5 audits this month. They reset on Nov 1.", limit: freeAuditLimit });
      expect(runAudit).not.toHaveBeenCalled();
    });

    it('keeps the claim when the site cannot be audited', async () => {
      givenDb({ 'audits.select': [ok(null)] });
      vi.mocked(runAudit).mockRejectedValue(new AuditUnavailableError('Blocked (403)'));
      const { status } = await post({ business_id: 'biz-1' });
      expect(status).toBe(502);
      expect(meter.claim).toHaveBeenCalledOnce();
      expect(meter.release).not.toHaveBeenCalled();
    });

    it('gives the audit back when it cannot be stored', async () => {
      givenDb({ 'audits.select': [ok(null)], 'audits.insert': [fail('permission denied')] });
      const { status, json } = await post({ business_id: 'biz-1' });
      expect(status).toBe(500);
      expect(json.error).toBe('Failed to store audit');
      expect(meter.release).toHaveBeenCalledOnce();
    });

    it('does not claim when the PageSpeed key is missing', async () => {
      vi.stubEnv('GOOGLE_PAGESPEED_API_KEY', '');
      givenDb({ 'audits.select': [ok(null)] });
      const { status } = await post({ business_id: 'biz-1' });
      expect(status).toBe(503);
      expect(meter.claim).not.toHaveBeenCalled();
    });

    it('does not claim for a business without a website', async () => {
      givenDb({ 'businesses.select': [ok({ ...business, website: null })], 'audits.select': [ok(null)] });
      const { status } = await post({ business_id: 'biz-1' });
      expect(status).toBe(400);
      expect(meter.claim).not.toHaveBeenCalled();
    });
  });
});
