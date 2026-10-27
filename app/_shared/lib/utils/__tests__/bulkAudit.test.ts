import { describe, it, expect, vi } from 'vitest';
import { auditBusiness, needsAudit, shownStatus, type BulkState, type Post } from '@/app/_shared/lib/utils/bulkAudit';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { AiReport, Audit, BusinessWithData } from '@/app/_shared/lib/types/auditely';

const AUDIT = { id: 'a1', business_id: 'b1' } as Audit;
const REPORT = { id: 'r1', audit_id: 'a1' } as AiReport;
const business = (over: Partial<BusinessWithData> = {}) =>
  ({ id: 'b1', name: 'Smile Dental', website: 'https://smiledental.com', ...over }) as BusinessWithData;

// Answers each API route from `answers`; records what was posted
function api(answers: Record<string, { ok: boolean; data: unknown }>) {
  const posts: [string, Record<string, unknown>][] = [];
  const post: Post = async (path, body) => {
    posts.push([path, body]);
    return answers[path];
  };
  return { post, posts };
}
const run = async (b: BusinessWithData, answers: Record<string, { ok: boolean; data: unknown }>) => {
  const { post, posts } = api(answers);
  const onUpdate = vi.fn();
  const stages: BulkState[] = [];
  await auditBusiness(b, { post, onUpdate, onStage: (_id, state) => stages.push(state) });
  return { posts, onUpdate, stages };
};

describe('needsAudit', () => {
  it('is true for a website with no audit, or an audit without its summary', () => {
    expect(needsAudit(business())).toBe(true);
    expect(needsAudit(business({ audit: AUDIT }))).toBe(true);
  });

  it('is false once audited and summarised, and for a business without a website', () => {
    expect(needsAudit(business({ audit: AUDIT, ai_report: REPORT }))).toBe(false);
    expect(needsAudit(business({ website: null }))).toBe(false);
  });
});

describe('auditBusiness', () => {
  it('audits, then writes the summary, handing each result to the list as it arrives', async () => {
    const { posts, onUpdate, stages } = await run(business(), {
      [API_ROUTES.AUDIT]: { ok: true, data: { audit: AUDIT, email: 'office@smiledental.com' } },
      [API_ROUTES.GENERATE]: { ok: true, data: { ai_report: REPORT } },
    });
    expect(posts).toEqual([
      [API_ROUTES.AUDIT, { business_id: 'b1', force: false }],
      [API_ROUTES.GENERATE, { audit_id: 'a1' }],
    ]);
    expect(onUpdate.mock.calls).toEqual([
      ['b1', { audit: AUDIT, email: 'office@smiledental.com' }],
      ['b1', { ai_report: REPORT }],
    ]);
    expect(stages.map((s) => s.stage)).toEqual(['auditing', 'writing', 'done']);
  });

  it("doesn't overwrite a known email when the audit found none", async () => {
    const { onUpdate } = await run(business(), {
      [API_ROUTES.AUDIT]: { ok: true, data: { audit: AUDIT, email: null } },
      [API_ROUTES.GENERATE]: { ok: true, data: { ai_report: REPORT } },
    });
    expect(onUpdate.mock.calls[0]).toEqual(['b1', { audit: AUDIT }]);
  });

  it('only writes the summary when the audit already exists', async () => {
    const { posts, stages } = await run(business({ audit: AUDIT }), {
      [API_ROUTES.GENERATE]: { ok: true, data: { ai_report: REPORT } },
    });
    expect(posts).toEqual([[API_ROUTES.GENERATE, { audit_id: 'a1' }]]);
    expect(stages.map((s) => s.stage)).toEqual(['writing', 'done']);
  });

  it("fails with the server's reason when the audit doesn't finish, and writes no summary", async () => {
    const { posts, onUpdate, stages } = await run(business(), {
      [API_ROUTES.AUDIT]: { ok: false, data: { error: "Couldn't audit this site: it didn't respond" } },
    });
    expect(posts).toHaveLength(1);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(stages.at(-1)).toEqual({ stage: 'failed', error: "Couldn't audit this site: it didn't respond" });
  });

  it('keeps the audit when only the summary fails', async () => {
    const { onUpdate, stages } = await run(business(), {
      [API_ROUTES.AUDIT]: { ok: true, data: { audit: AUDIT } },
      [API_ROUTES.GENERATE]: { ok: false, data: null },
    });
    expect(onUpdate.mock.calls).toEqual([['b1', { audit: AUDIT }]]);
    expect(stages.at(-1)).toEqual({ stage: 'failed', error: "Couldn't write the AI summary." });
  });

  it('stops short of the summary when the plan limit is reached, without failing the business', async () => {
    const limit = { kind: 'audit', plan: 'free', limit: 5, resetsAt: '2026-11-01T00:00:00.000Z' };
    const post = vi.fn<Post>(async () => ({
      ok: false,
      data: { error: "You've used your 5 audits this month. They reset on Nov 1.", limit },
    }));
    const onStage = vi.fn();
    const onLimit = vi.fn();
    await auditBusiness(business(), { post, onUpdate: vi.fn(), onStage, onLimit });
    expect(onLimit).toHaveBeenCalledWith(limit);
    expect(onStage).toHaveBeenLastCalledWith('b1', { stage: 'queued' });
    // No summary request
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('still fails a business on any other error', async () => {
    const onLimit = vi.fn();
    const stages: BulkState[] = [];
    const post: Post = async () => ({ ok: false, data: { error: 'Audit failed' } });
    await auditBusiness(business(), { post, onUpdate: vi.fn(), onStage: (_id, state) => stages.push(state), onLimit });
    expect(stages.at(-1)).toEqual({ stage: 'failed', error: 'Audit failed' });
    expect(onLimit).not.toHaveBeenCalled();
  });
});

describe('shownStatus', () => {
  const idle = { auditStatus: 'idle', reportStatus: 'idle', auditError: null } as const;
  const audited = { auditStatus: 'done', reportStatus: 'idle', auditError: null } as const;

  it("shows the card's own state when Audit all isn't handling it", () => {
    expect(shownStatus(idle, undefined)).toEqual({ ...idle, queued: false });
  });

  it('shows a queued, auditing or failed business on a card that has done nothing itself', () => {
    expect(shownStatus(idle, { stage: 'queued' })).toEqual({ ...idle, queued: true });
    expect(shownStatus(idle, { stage: 'auditing' })).toMatchObject({ auditStatus: 'loading', queued: false });
    expect(shownStatus(idle, { stage: 'failed', error: 'Site is down' })).toMatchObject({ auditStatus: 'error', auditError: 'Site is down' });
  });

  it('shows the summary being written, or failing, once the audit is there', () => {
    expect(shownStatus(audited, { stage: 'writing' })).toMatchObject({ auditStatus: 'done', reportStatus: 'loading' });
    expect(shownStatus(audited, { stage: 'failed', error: "Couldn't write the AI summary." })).toMatchObject({
      auditStatus: 'done',
      reportStatus: 'error',
      auditError: null,
    });
  });

  it("lets the card's own activity win: a retry after a failed bulk audit shows as loading", () => {
    const retrying = { auditStatus: 'loading', reportStatus: 'idle', auditError: null } as const;
    expect(shownStatus(retrying, { stage: 'failed', error: 'Site is down' })).toEqual({ ...retrying, queued: false });
    const done = { auditStatus: 'done', reportStatus: 'done', auditError: null } as const;
    expect(shownStatus(done, { stage: 'failed', error: 'x' })).toEqual({ ...done, queued: false });
  });
});
