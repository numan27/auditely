import { describe, it, expect, vi, afterEach } from 'vitest';
import { REPLAY_WAIT, replayPost } from '@/app/_shared/lib/demo/replay';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { auditBusiness, type BulkState } from '@/app/_shared/lib/utils/bulkAudit';
import type { AiReport, Audit, BusinessWithData } from '@/app/_shared/lib/types/auditely';

const NO_WAIT = { auditMs: 0, reportMs: 0 };
const AUDIT = { id: 'demo-a1', business_id: 'demo-b1' } as Audit;
const REPORT = { id: 'demo-r1', audit_id: 'demo-a1' } as AiReport;
const LONE_AUDIT = { id: 'demo-a3', business_id: 'demo-b3' } as Audit;
const samples = [
  { id: 'demo-b1', website: 'https://one.com', audit: AUDIT, ai_report: REPORT },
  { id: 'demo-b2', website: 'https://two.com' },
  { id: 'demo-b3', website: 'https://three.com', audit: LONE_AUDIT },
] as BusinessWithData[];
const post = replayPost(samples, NO_WAIT);
const errorOf = (res: { data: unknown }) => (res.data as { error: string }).error;

afterEach(() => vi.useRealTimers());

describe('replayPost', () => {
  it("answers an audit request with the saved audit, in the real route's shape", async () => {
    expect(await post(API_ROUTES.AUDIT, { business_id: 'demo-b1', force: false })).toEqual({ ok: true, data: { audit: AUDIT } });
  });

  it('answers a summary request with the saved report', async () => {
    expect(await post(API_ROUTES.GENERATE, { audit_id: 'demo-a1' })).toEqual({ ok: true, data: { ai_report: REPORT } });
  });

  it('fails with a reason for a business that has no saved audit, or that it does not know', async () => {
    for (const id of ['demo-b2', 'someone-else']) {
      const res = await post(API_ROUTES.AUDIT, { business_id: id });
      expect(res.ok).toBe(false);
      expect(errorOf(res)).toBe('This business has no saved audit to replay.');
    }
  });

  it('fails with a reason for an audit that has no saved summary', async () => {
    const res = await post(API_ROUTES.GENERATE, { audit_id: 'demo-a3' });
    expect(res.ok).toBe(false);
    expect(errorOf(res)).toBe('This audit has no saved summary to replay.');
  });

  it('answers no other route', async () => {
    for (const path of [API_ROUTES.SEARCH, API_ROUTES.FIND_EMAILS, API_ROUTES.SEND_EMAIL, API_ROUTES.CRM, API_ROUTES.PDF]) {
      expect((await post(path, {})).ok).toBe(false);
    }
  });

  it('waits before answering, so the progress can be seen', async () => {
    vi.useFakeTimers();
    expect(REPLAY_WAIT).toEqual({ auditMs: 4000, reportMs: 2500 });
    let answered = false;
    const pending = replayPost(samples)(API_ROUTES.AUDIT, { business_id: 'demo-b1' }).then(() => {
      answered = true;
    });
    await vi.advanceTimersByTimeAsync(3999);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(answered).toBe(true);
  });
});

describe('"Audit all" on the replay', () => {
  const run = async (business: BusinessWithData) => {
    const onUpdate = vi.fn();
    const stages: BulkState[] = [];
    await auditBusiness(business, { post, onUpdate, onStage: (_id, state) => stages.push(state) });
    return { onUpdate, stages };
  };

  it('takes a business through the real steps to its saved audit and summary', async () => {
    const { onUpdate, stages } = await run({ ...samples[0], audit: undefined, ai_report: undefined });
    expect(stages.map((s) => s.stage)).toEqual(['auditing', 'writing', 'done']);
    expect(onUpdate.mock.calls).toEqual([
      ['demo-b1', { audit: AUDIT }],
      ['demo-b1', { ai_report: REPORT }],
    ]);
  });

  it('marks a business it cannot replay as failed, with the reason', async () => {
    const { stages } = await run(samples[1]);
    expect(stages.at(-1)).toEqual({ stage: 'failed', error: 'This business has no saved audit to replay.' });
  });
});
