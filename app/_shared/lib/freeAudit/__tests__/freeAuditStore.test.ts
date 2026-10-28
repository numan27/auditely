import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The service client: rpc() is a mock; every from() chain is recorded call by
// call and, awaited, answers `result`
const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  calls: [] as unknown[][],
  result: { data: null, error: null } as { data: unknown; error: { message: string } | null },
}));
vi.mock('@/app/_shared/lib/supabase/client', () => {
  const METHODS = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'gte', 'order', 'limit', 'maybeSingle'];
  const from = (table: string) => {
    db.calls.push(['from', table]);
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(db.result).then(resolve, reject),
    };
    for (const method of METHODS) {
      chain[method] = (...args: unknown[]) => {
        db.calls.push([method, ...args]);
        return chain;
      };
    }
    return chain;
  };
  return { serviceDb: { from, rpc: (...args: unknown[]) => db.rpc(...args) } };
});

const { claimFreeAudit, findFreeAudit, freeAuditsSince, releaseFreeAudit, saveFreeAudit, takeFreeAudit } = await import(
  '@/app/_shared/lib/freeAudit/freeAuditStore'
);

const SINCE = new Date('2026-10-04T12:00:00Z');
const DAY = new Date('2026-11-03T00:00:00Z');
const AUDIT = { performance_score: 71, seo_score: 80 } as never;
const ROW = {
  id: 'f1',
  website: 'https://example.com/',
  audit: AUDIT,
  report: { summary: 'S', improvements: ['A'], cold_email: 'Hi' },
  created_at: '2026-11-03T10:00:00Z',
  claimed_by: null,
};

beforeEach(() => {
  db.rpc.mockReset();
  db.calls = [];
  db.result = { data: null, error: null };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const claim = () => claimFreeAudit({ ipHash: 'h', website: 'https://example.com/', since: SINCE, dayStart: DAY, dailyCap: 200 });

describe('claimFreeAudit', () => {
  it('claims through claim_free_audit with the window, the day and the cap', async () => {
    db.rpc.mockResolvedValue({ data: [{ id: 'f1', refused: null }], error: null });
    expect(await claim()).toEqual({ ok: true, id: 'f1' });
    expect(db.rpc).toHaveBeenCalledWith('claim_free_audit', {
      p_ip_hash: 'h',
      p_website: 'https://example.com/',
      p_since: SINCE.toISOString(),
      p_day_start: DAY.toISOString(),
      p_daily_cap: 200,
    });
  });

  it('passes on a refusal', async () => {
    db.rpc.mockResolvedValue({ data: [{ id: null, refused: 'cap' }], error: null });
    expect(await claim()).toEqual({ ok: false, reason: 'cap' });
    db.rpc.mockResolvedValue({ data: [{ id: null, refused: 'visitor' }], error: null });
    expect(await claim()).toEqual({ ok: false, reason: 'visitor' });
  });

  it('throws when the claim itself fails', async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: 'function claim_free_audit does not exist' } });
    await expect(claim()).rejects.toThrow('claim_free_audit does not exist');
    db.rpc.mockResolvedValue({ data: [], error: null });
    await expect(claim()).rejects.toThrow();
  });
});

describe('releaseFreeAudit', () => {
  it('deletes only a running claim, and never throws', async () => {
    await releaseFreeAudit('f1');
    expect(db.calls).toEqual([['from', 'free_audits'], ['delete'], ['eq', 'id', 'f1'], ['eq', 'status', 'running']]);
    db.result = { data: null, error: { message: 'down' } };
    await expect(releaseFreeAudit('f1')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[free-audit] Couldn't release f1: down");
  });
});

describe('saveFreeAudit', () => {
  it('marks the audit done with its results, and throws on an error', async () => {
    await saveFreeAudit('f1', AUDIT, ROW.report);
    expect(db.calls).toEqual([
      ['from', 'free_audits'],
      ['update', { status: 'done', audit: AUDIT, report: ROW.report }],
      ['eq', 'id', 'f1'],
    ]);
    db.result = { data: null, error: { message: 'down' } };
    await expect(saveFreeAudit('f1', AUDIT, null)).rejects.toThrow('down');
  });
});

describe('findFreeAudit', () => {
  it('reads a finished audit, and nothing on an error', async () => {
    db.result = { data: ROW, error: null };
    expect(await findFreeAudit('f1')).toEqual({
      id: 'f1',
      website: 'https://example.com/',
      audit: AUDIT,
      report: ROW.report,
      createdAt: '2026-11-03T10:00:00Z',
      claimedBy: null,
    });
    expect(db.calls).toContainEqual(['eq', 'status', 'done']);
    db.result = { data: null, error: { message: 'down' } };
    expect(await findFreeAudit('f1')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('takeFreeAudit', () => {
  it('takes an audit only once, and only a finished one', async () => {
    db.result = { data: { ...ROW, claimed_by: 'u1' }, error: null };
    expect(await takeFreeAudit('f1', 'u1')).toMatchObject({ id: 'f1', claimedBy: 'u1' });
    const update = db.calls.find(([method]) => method === 'update') as [string, { claimed_by: string; claimed_at: string }];
    expect(update[1].claimed_by).toBe('u1');
    expect(Number.isNaN(Date.parse(update[1].claimed_at))).toBe(false);
    expect(db.calls).toContainEqual(['eq', 'id', 'f1']);
    expect(db.calls).toContainEqual(['eq', 'status', 'done']);
    expect(db.calls).toContainEqual(['is', 'claimed_by', null]);
    expect(db.calls.at(-1)).toEqual(['maybeSingle']);
  });

  it('gives nothing when it was taken already or the update failed', async () => {
    db.result = { data: null, error: null };
    expect(await takeFreeAudit('f1', 'u1')).toBeNull();
    db.result = { data: null, error: { message: 'down' } };
    expect(await takeFreeAudit('f1', 'u1')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('freeAuditsSince', () => {
  it('lists today with whether each was kept', async () => {
    db.result = {
      data: [
        { website: 'https://a.com/', created_at: '2026-11-03T11:00:00Z', status: 'done', claimed_by: 'u1' },
        { website: 'https://b.com/', created_at: '2026-11-03T10:00:00Z', status: 'running', claimed_by: null },
      ],
      error: null,
    };
    expect(await freeAuditsSince(DAY)).toEqual([
      { website: 'https://a.com/', createdAt: '2026-11-03T11:00:00Z', status: 'done', kept: true },
      { website: 'https://b.com/', createdAt: '2026-11-03T10:00:00Z', status: 'running', kept: false },
    ]);
    expect(db.calls).toContainEqual(['gte', 'created_at', DAY.toISOString()]);
    expect(db.calls).toContainEqual(['order', 'created_at', { ascending: false }]);
    expect(db.calls).toContainEqual(['limit', 500]);
    db.result = { data: null, error: { message: 'down' } };
    expect(await freeAuditsSince(DAY)).toBeNull();
  });
});
