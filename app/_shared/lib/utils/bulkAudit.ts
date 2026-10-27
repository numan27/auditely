// app/_shared/lib/utils/bulkAudit.ts

// "Audit all": which businesses it works on, the steps for one of them, and
// what a card shows meanwhile. The queue itself is useBulkAudit.

import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { AiReport, Audit, AuditStatus, BusinessUpdate, BusinessWithData, ReportStatus } from '@/app/_shared/lib/types/auditely';
import { readLimit, type LimitReached } from '@/app/_shared/lib/usage/plans';

// An audit runs PageSpeed twice and a summary calls the AI: three at a time
// keeps well inside both services' rate limits
export const BULK_CONCURRENCY = 3;

export type BulkStage = 'queued' | 'auditing' | 'writing' | 'done' | 'failed';

export interface BulkState {
  stage: BulkStage;
  /** Why it failed */
  error?: string;
}

/** `data` is the JSON answer; null when the request itself failed */
export type Post = (path: string, body: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown }>;

interface BulkDeps {
  post: Post;
  /** Each result goes to the results list as it arrives; the cards read it from there */
  onUpdate: (businessId: string, update: BusinessUpdate) => void;
  onStage: (businessId: string, state: BulkState) => void;
  /** The plan's audits ran out: the business goes back to waiting, not failed */
  onLimit?: (limit: LimitReached) => void;
}

/** A business "Audit all" works on: it has a website and no audit, or no AI summary yet */
export function needsAudit(business: Pick<BusinessWithData, 'website' | 'audit' | 'ai_report'>): boolean {
  return !!business.website && (!business.audit || !business.ai_report);
}

/** Audits one business (unless it already has an audit), then writes its summary */
export async function auditBusiness(business: BusinessWithData, { post, onUpdate, onStage, onLimit }: BulkDeps): Promise<void> {
  const { id } = business;
  let audit = business.audit;

  if (!audit) {
    onStage(id, { stage: 'auditing' });
    const res = await post(API_ROUTES.AUDIT, { business_id: id, force: false });
    const data = res.data as { audit?: Audit; email?: string | null; error?: string } | null;
    if (!res.ok || !data?.audit) {
      const limit = readLimit(res.data);
      if (!limit) return onStage(id, { stage: 'failed', error: data?.error || 'Audit failed' });
      onStage(id, { stage: 'queued' });
      return onLimit?.(limit);
    }
    audit = data.audit;
    onUpdate(id, { audit, ...(data.email && { email: data.email }) });
  }

  onStage(id, { stage: 'writing' });
  const res = await post(API_ROUTES.GENERATE, { audit_id: audit.id });
  const report = (res.data as { ai_report?: AiReport } | null)?.ai_report;
  if (!res.ok || !report) return onStage(id, { stage: 'failed', error: "Couldn't write the AI summary." });
  onUpdate(id, { ai_report: report });
  onStage(id, { stage: 'done' });
}

interface CardStatus {
  auditStatus: AuditStatus;
  reportStatus: ReportStatus;
  auditError: string | null;
}

/**
 * What a card shows while "Audit all" handles its business. The card's own
 * activity always wins: bulk state only fills in a step the card hasn't
 * started itself, so "Try again" on a failed card shows as loading.
 */
export function shownStatus(own: CardStatus, bulk: BulkState | undefined): CardStatus & { queued: boolean } {
  const shown = { ...own, queued: bulk?.stage === 'queued' };
  if (!bulk) return shown;

  if (own.auditStatus === 'idle') {
    if (bulk.stage === 'auditing') shown.auditStatus = 'loading';
    if (bulk.stage === 'failed') {
      shown.auditStatus = 'error';
      shown.auditError = bulk.error ?? null;
    }
  } else if (own.auditStatus === 'done' && own.reportStatus === 'idle') {
    if (bulk.stage === 'writing') shown.reportStatus = 'loading';
    if (bulk.stage === 'failed') shown.reportStatus = 'error';
  }
  return shown;
}
