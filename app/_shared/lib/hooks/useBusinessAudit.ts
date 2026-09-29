// app/_shared/lib/hooks/useBusinessAudit.ts

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { downloadBlob } from '@/app/_shared/lib/utils/browserExport';
import type { AiReport, Audit, AuditStatus, Business, BusinessUpdate, ReportStatus } from '@/app/_shared/lib/types/auditely';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Audit + AI-report state and actions for one business card.
 * - runAudit(): serves a current cached audit, otherwise audits fresh
 * - reAudit(): forces a fresh audit; the server replaces the row and drops the
 *   stale report, so the report is regenerated afterwards
 * - retryAudit(): repeats the last request (normal or forced)
 * Every result is also passed to `onUpdate`, so the results list can sort,
 * filter and export on it.
 */
export function useBusinessAudit(
  business: Business,
  initialAudit?: Audit,
  initialReport?: AiReport,
  onUpdate?: (businessId: string, update: BusinessUpdate) => void
) {
  const [audit, setAudit] = useState<Audit | undefined>(initialAudit);
  const [report, setReport] = useState<AiReport | undefined>(initialReport);
  const [auditStatus, setAuditStatus] = useState<AuditStatus>(initialAudit ? 'done' : 'idle');
  const [auditError, setAuditError] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus>(initialReport ? 'done' : 'idle');
  const [email, setEmail] = useState<string | null>(business.email ?? null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const lastForce = useRef(false);

  // Reflect emails discovered by background discovery (updates the prop).
  useEffect(() => {
    if (business.email) setEmail(business.email);
  }, [business.email]);

  // A card sorted or filtered out of view unmounts; results for requests it had
  // in flight reach the list via onUpdate and come back in through these props.
  useEffect(() => {
    if (!initialAudit) return;
    setAudit(initialAudit);
    setAuditStatus('done');
  }, [initialAudit]);

  useEffect(() => {
    if (!initialReport) return;
    setReport(initialReport);
    setReportStatus('done');
  }, [initialReport]);

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
      const res = await fetch(API_ROUTES.GENERATE, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ audit_id: auditId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.ai_report);
      setReportStatus('done');
      onUpdate?.(business.id, { ai_report: data.ai_report });
    } catch {
      setReportStatus('error');
    }
  }, [business.id, onUpdate]);

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
        const res = await fetch(API_ROUTES.AUDIT, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ business_id: business.id, force }),
        });
        const data = await res.json();
        if (!res.ok) return fail(data.error || 'Audit failed');
        setAudit(data.audit);
        if (data.email) setEmail(data.email);
        if (force) setReport(undefined);
        setAuditStatus('done');
        onUpdate?.(business.id, {
          audit: data.audit,
          ...(data.email && { email: data.email }),
          ...(force && { ai_report: undefined }),
        });
        generateReport(data.audit.id);
      } catch {
        fail('Audit failed');
      }
    },
    [audit, business.id, generateReport, onUpdate]
  );

  const reAudit = useCallback(() => runAudit(true), [runAudit]);
  const retryAudit = useCallback(() => runAudit(lastForce.current), [runAudit]);

  const downloadPdf = useCallback(async () => {
    if (!audit) return;
    setPdfLoading(true);
    try {
      const res = await fetch(API_ROUTES.PDF, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ audit_id: audit.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const blob = await res.blob();
      downloadBlob(blob, `audit-${business.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setPdfLoading(false);
    }
  }, [audit, business.name]);

  return {
    audit,
    report,
    auditStatus,
    auditError,
    reportStatus,
    email,
    saveEmail,
    pdfLoading,
    runAudit,
    reAudit,
    retryAudit,
    generateReport,
    downloadPdf,
  };
}
