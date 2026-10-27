// app/_shared/lib/notifications/messages.ts

// What each notification says. Each has a dedupe key, so the same event
// (a request resent, a due reminder seen twice) is one notification.

import { dayKeyLabel } from '@/app/_shared/lib/utils/requestDue';
import { searchTitle } from '@/app/_shared/lib/utils/searchLabel';
import type { NotificationKind } from '@/app/_shared/lib/notifications/notificationTypes';

export interface NewNotification {
  kind: NotificationKind;
  title: string;
  body: string;
  business_id: string | null;
  search_id: string | null;
  dedupe_key: string | null;
}

/** The request as the bell describes it: the card's name (the website) and who asked */
export interface RequestRef {
  id: string;
  host: string;
  name?: string | null;
}

const asker = (request: RequestRef) => request.name?.trim() || request.host;

export const requestNew = (request: RequestRef): NewNotification => ({
  kind: 'request_new',
  title: `New audit request from ${asker(request)}`,
  body: `${request.host} is being audited now. Reply within one business day.`,
  business_id: request.id,
  search_id: null,
  dedupe_key: `request_new:${request.id}`,
});

export const requestAudited = (request: RequestRef): NewNotification => ({
  kind: 'request_audited',
  title: `${request.host} is audited`,
  body: `The report for ${asker(request)} is ready to send.`,
  business_id: request.id,
  search_id: null,
  dedupe_key: `request_audited:${request.id}`,
});

/** `step`: the audit itself failed, or only its AI summary */
export const requestAuditFailed = (request: RequestRef, step: 'audit' | 'summary'): NewNotification => ({
  kind: 'request_audit_failed',
  title: step === 'audit' ? `Couldn't audit ${request.host}` : `Couldn't write the summary for ${request.host}`,
  body: step === 'audit' ? 'Open the request and run the audit again.' : 'The scores are in. Open the request to write the summary again.',
  business_id: request.id,
  search_id: null,
  dedupe_key: `request_audit_failed:${request.id}`,
});

export const requestDue = (request: RequestRef): NewNotification => ({
  kind: 'request_due',
  title: `Reply to ${asker(request)} today`,
  body: `The free audit of ${request.host} is due a reply today.`,
  business_id: request.id,
  search_id: null,
  dedupe_key: `request_due:${request.id}`,
});

/** `dueKey`: the day the reply was due ("2026-10-28") */
export const requestOverdue = (request: RequestRef, dueKey: string): NewNotification => ({
  kind: 'request_overdue',
  title: `Reply to ${asker(request)} is overdue`,
  body: `The free audit of ${request.host} was due a reply on ${dayKeyLabel(dueKey)}.`,
  business_id: request.id,
  search_id: null,
  dedupe_key: `request_overdue:${request.id}`,
});

export interface BulkRun {
  searchId: string;
  search: { niche: string; location: string } | null;
  audited: number;
  failed: number;
}

/** "Audit all" ran to the end. Not deduplicated: each run is its own. */
export function bulkDone({ searchId, search, audited, failed }: BulkRun): NewNotification {
  const sites = (n: number) => `${n} ${n === 1 ? 'website' : 'websites'}`;
  const counts = failed > 0 ? `${sites(audited)} audited, ${failed} failed.` : `${sites(audited)} audited.`;
  return {
    kind: 'bulk_done',
    title: search ? `"Audit all" finished: ${searchTitle(search)}` : '"Audit all" finished',
    body: failed > 0 ? `${counts} Run "Audit all" again to retry them.` : counts,
    business_id: null,
    search_id: searchId,
    dedupe_key: null,
  };
}
