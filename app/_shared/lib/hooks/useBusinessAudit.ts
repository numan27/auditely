// app/_shared/lib/hooks/useBusinessAudit.ts

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES, demoReportPath } from '@/app/_shared/lib/config/routes';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { useUsage } from '@/app/_shared/lib/hooks/useUsage';
import { readLimit } from '@/app/_shared/lib/usage/plans';
import { downloadBlob } from '@/app/_shared/lib/utils/browserExport';
import { shownStatus, type BulkState, type Post } from '@/app/_shared/lib/utils/bulkAudit';
import type { AiReport, Audit, AuditStatus, Business, BusinessUpdate, PdfVariant, ReportStatus } from '@/app/_shared/lib/types/auditely';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const REWRITE_FAILED = "Couldn't write it again. Try again in a minute.";

// The real routes. In the public demo the saved sample answers instead (demo/replay.ts).
const send: Post = async (path, body) => {
  const res = await fetch(path, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json() };
};

/** An audit's PDF report, in the version asked for. The demo's are built ahead from the saved sample, in one version. */
export const requestPdf = (auditId: string, variant: PdfVariant, demo: boolean): Promise<Response> =>
  demo
    ? fetch(demoReportPath(auditId))
    : fetch(API_ROUTES.PDF, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ audit_id: auditId, variant }) });

export const pdfDownloadName = (businessName: string, variant: PdfVariant): string =>
  `audit-${businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}${variant === 'upwork' ? '-upwork' : ''}.pdf`;

/**
 * Audit + AI-report state and actions for one business card.
 * - runAudit(): serves a current cached audit, otherwise audits fresh
 * - reAudit(): forces a fresh audit; the server replaces the row and drops the
 *   stale report, so the report is regenerated afterwards
 * - retryAudit(): repeats the last request (normal or forced)
 * - rewriteReport(): "Write again", a new summary and email in place of the
 *   saved ones; the old ones stay on screen until the new ones are in
 * Every result is also passed to `onUpdate`, so the results list can sort,
 * filter and export on it. With `autoRun`, the audit starts on mount.
 * While "Audit all" handles the business (`bulk`), the statuses show its
 * progress; its results arrive through the `initial*` props.
 * In the public demo the audit and summary are replayed from the saved sample,
 * Re-audit opens the demo's notice, and the PDF is the sample's.
 */
export interface BusinessAuditOptions {
  initialAudit?: Audit;
  initialReport?: AiReport;
  onUpdate?: (businessId: string, update: BusinessUpdate) => void;
  autoRun?: boolean;
  bulk?: BulkState;
}

export function useBusinessAudit(
  business: Business,
  { initialAudit, initialReport, onUpdate, autoRun = false, bulk }: BusinessAuditOptions = {}
) {
  const demo = useDemo();
  const usage = useUsage();
  const request = demo?.replay ?? send;
  const [audit, setAudit] = useState<Audit | undefined>(initialAudit);
  const [report, setReport] = useState<AiReport | undefined>(initialReport);
  const [auditStatus, setAuditStatus] = useState<AuditStatus>(initialAudit ? 'done' : 'idle');
  const [auditError, setAuditError] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus>(initialReport ? 'done' : 'idle');
  const [email, setEmail] = useState<string | null>(business.email ?? null);
  // Which version is being prepared
  const [pdfLoading, setPdfLoading] = useState<PdfVariant | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const lastForce = useRef(false);

  // Reflect emails discovered by background discovery (updates the prop).
  useEffect(() => {
    if (business.email) setEmail(business.email);
  }, [business.email]);

  // A card sorted or filtered out of view unmounts; results for requests it had
  // in flight reach the list via onUpdate and come back in through these props,
  // as do the results of "Audit all". Taken in during render (not in an effect),
  // so the card never shows a frame of "Not audited yet" in between.
  const [synced, setSynced] = useState({ audit: initialAudit, report: initialReport });
  if (synced.audit !== initialAudit || synced.report !== initialReport) {
    setSynced({ audit: initialAudit, report: initialReport });
    if (initialAudit && initialAudit !== synced.audit) {
      setAudit(initialAudit);
      setAuditStatus('done');
    }
    if (initialReport && initialReport !== synced.report) {
      setReport(initialReport);
      setReportStatus('done');
    }
  }

  const saveEmail = useCallback(
    (value: string) => {
      setEmail(value);
      onUpdate?.(business.id, { email: value });
    },
    [business.id, onUpdate]
  );

  const generateReport = useCallback(async (auditId: string) => {
    setReportStatus('loading');
    try {
      const { ok, data } = await request(API_ROUTES.GENERATE, { audit_id: auditId });
      const { ai_report, error } = data as { ai_report: AiReport; error?: string };
      if (!ok) throw new Error(error);
      setReport(ai_report);
      setReportStatus('done');
      onUpdate?.(business.id, { ai_report });
    } catch {
      setReportStatus('error');
    }
  }, [business.id, onUpdate, request]);

  const rewriteReport = useCallback(
    async (auditId: string) => {
      setRewriting(true);
      setRewriteError(null);
      try {
        const { ok, data } = await request(API_ROUTES.GENERATE, { audit_id: auditId, rewrite: true });
        const { ai_report, error } = data as { ai_report: AiReport; error?: string };
        if (!ok) return setRewriteError(error || REWRITE_FAILED);
        setReport(ai_report);
        onUpdate?.(business.id, { ai_report });
      } catch {
        setRewriteError(REWRITE_FAILED);
      } finally {
        setRewriting(false);
      }
    },
    [business.id, onUpdate, request]
  );

  const runAudit = useCallback(
    async (force = false) => {
      lastForce.current = force;
      setAuditStatus('loading');
      setAuditError(null);
      // A failed Re-audit keeps the previous results visible alongside the server's reason
      const fail = (message: string) => {
        setAuditError(message);
        setAuditStatus(audit ? 'done' : 'error');
      };
      try {
        const { ok, data } = await request(API_ROUTES.AUDIT, { business_id: business.id, force });
        const result = data as { audit: Audit; email?: string | null; error?: string };
        if (!ok) {
          // Past the plan's audits: the dialog explains it, and the card goes back to how it was
          const limit = readLimit(data);
          if (limit && usage) {
            usage.promptUpgrade({ limit });
            return setAuditStatus(audit ? 'done' : 'idle');
          }
          return fail(result.error || 'Audit failed');
        }
        setAudit(result.audit);
        if (result.email) setEmail(result.email);
        if (force) setReport(undefined);
        setAuditStatus('done');
        onUpdate?.(business.id, {
          audit: result.audit,
          ...(result.email && { email: result.email }),
          ...(force && { ai_report: undefined }),
        });
        generateReport(result.audit.id);
      } catch {
        fail('Audit failed');
      } finally {
        // The meter reads afresh whatever happened: a failed audit is usually given back, but not always
        usage?.refresh();
      }
    },
    [audit, business.id, generateReport, onUpdate, request, usage]
  );

  // Sites added from the URL form audit straight away. The ref stops Strict
  // Mode's second effect run from starting a second audit.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoRun || autoStarted.current || initialAudit) return;
    autoStarted.current = true;
    runAudit();
  }, [autoRun, initialAudit, runAudit]);

  // The demo has one saved audit per business: nothing fresh to measure
  const reAudit = useCallback(() => (demo ? demo.restrict('reaudit') : runAudit(true)), [demo, runAudit]);
  const retryAudit = useCallback(() => runAudit(lastForce.current), [runAudit]);

  const downloadPdf = useCallback(
    async (variant: PdfVariant = 'full') => {
      if (!audit) return;
      setPdfLoading(variant);
      try {
        const res = await requestPdf(audit.id, variant, !!demo);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        const blob = await res.blob();
        downloadBlob(blob, pdfDownloadName(business.name, variant));
      } catch (err) {
        console.error('PDF download failed:', err);
      } finally {
        setPdfLoading(null);
      }
    },
    [audit, business.name, demo]
  );

  return {
    audit,
    report,
    // auditStatus, auditError, reportStatus, and `queued` while it waits its turn
    ...shownStatus({ auditStatus, reportStatus, auditError }, bulk),
    email,
    saveEmail,
    pdfLoading,
    runAudit,
    reAudit,
    retryAudit,
    generateReport,
    rewriteReport,
    rewriting,
    rewriteError,
    downloadPdf,
  };
}
