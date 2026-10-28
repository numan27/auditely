import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Db } from '@/app/_shared/lib/supabase/client';

type Result = { data: unknown; error: { message: string } | null };

// Chainable fake of the signed-in user's query builder; responses are queued per `table.op`
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

const take = vi.hoisted(() => vi.fn());
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/freeAudit/freeAuditStore', () => ({ takeFreeAudit: take }));

const { keepFreeAudit } = await import('@/app/_shared/lib/freeAudit/keepFreeAudit');
const { signFreeAuditCookie } = await import('@/app/_shared/lib/freeAudit/freeAuditRules');

const SECRET = 'a'.repeat(40);
const ID = '6f1f3c1e-8a4b-4c55-9a51-0d7a2b1c9e10';
const AUDIT = { performance_score: 72, seo_score: 80, checks: {}, raw_json: { mobile: null, desktop: null }, engine_version: 3 };
const REPORT = { summary: 'Slow on phones.', improvements: ['Compress the images'], cold_email: 'Subject: Hi\n\nHello' };
const RECORD = {
  id: ID,
  website: 'https://www.houstondental.com',
  audit: AUDIT,
  report: REPORT,
  createdAt: '2026-11-01T10:00:00.000Z',
  claimedBy: 'u1',
};

const ok = (data: unknown): Result => ({ data, error: null });
const inserts = (table: string) => db.state.calls.filter((c) => c.table === table && c.op === 'insert');
const userDb = { from: db.from } as unknown as Db;
let keep: string;

beforeEach(async () => {
  vi.stubEnv('AUTH_SECRET', SECRET);
  db.state.responses = {
    'searches.select': [ok({ id: 'direct-1' })],
    'businesses.select': [ok([])],
    'businesses.insert': [ok({ id: 'b1' })],
    'audits.insert': [ok({ id: 'a1' })],
    'ai_reports.insert': [ok(null)],
  };
  db.state.calls = [];
  take.mockReset();
  take.mockResolvedValue(RECORD);
  keep = await signFreeAuditCookie(ID, SECRET);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('keepFreeAudit', () => {
  it("copies the visitor's audit and summary into the new account's audits, as that account", async () => {
    expect(await keepFreeAudit(userDb, 'u1', keep)).toBe(true);
    expect(take).toHaveBeenCalledWith(ID, 'u1');
    expect(inserts('businesses').map((c) => c.payload)).toEqual([
      { search_id: 'direct-1', name: 'houstondental.com', address: '', website: 'https://www.houstondental.com' },
    ]);
    expect(inserts('audits').map((c) => c.payload)).toEqual([{ business_id: 'b1', ...AUDIT }]);
    expect(inserts('ai_reports').map((c) => c.payload)).toEqual([{ audit_id: 'a1', ...REPORT }]);
  });

  it("adds the account's website audits list when it hasn't one yet", async () => {
    db.state.responses['searches.select'] = [ok(null)];
    db.state.responses['searches.insert'] = [ok({ id: 'direct-new' })];
    expect(await keepFreeAudit(userDb, 'u1', keep)).toBe(true);
    expect(inserts('searches').map((c) => c.payload)).toEqual([{ niche: 'website audits', location: 'added by url' }]);
    expect(inserts('businesses')[0].payload).toMatchObject({ search_id: 'direct-new' });
  });

  it('keeps an audit without a summary', async () => {
    take.mockResolvedValue({ ...RECORD, report: null });
    expect(await keepFreeAudit(userDb, 'u1', keep)).toBe(true);
    expect(inserts('audits')).toHaveLength(1);
    expect(inserts('ai_reports')).toHaveLength(0);
  });

  it("doesn't copy an audit someone else already kept", async () => {
    take.mockResolvedValue(null);
    expect(await keepFreeAudit(userDb, 'u1', keep)).toBe(false);
    expect(db.state.calls.filter((c) => c.op === 'insert')).toEqual([]);
  });

  it('ignores a forged keep value', async () => {
    for (const forged of [`${ID}.forged`, 'garbage', '', null, undefined]) {
      expect(await keepFreeAudit(userDb, 'u1', forged)).toBe(false);
    }
    expect(take).not.toHaveBeenCalled();
  });

  it('keeps a site the account already has without adding it twice', async () => {
    db.state.responses['businesses.select'] = [ok([{ id: 'b0', website: 'https://houstondental.com/' }])];
    expect(await keepFreeAudit(userDb, 'u1', keep)).toBe(true);
    expect(db.state.calls.filter((c) => c.op === 'insert')).toEqual([]);
  });

  it('logs and gives up when an insert fails', async () => {
    db.state.responses['audits.insert'] = [{ data: null, error: { message: 'violates row-level security' } }];
    expect(await keepFreeAudit(userDb, 'u1', keep)).toBe(false);
    expect(console.error).toHaveBeenCalledWith(`[free-audit] Couldn't keep ${ID}: violates row-level security`);
    expect(inserts('ai_reports')).toHaveLength(0);
  });
});
