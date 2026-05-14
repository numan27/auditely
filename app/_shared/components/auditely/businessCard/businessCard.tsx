// app/_shared/components/auditely/businessCard/businessCard.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { Badge } from '@/app/_shared/components/ui/badge/badge';
import { AuditScores } from '@/app/_shared/components/auditely/auditScores/auditScores';
import { AiReportSection } from '@/app/_shared/components/auditely/aiReportSection/aiReportSection';
import type { Business, Audit, AiReport, AuditStatus, ReportStatus } from '@/app/_shared/lib/types/auditely';

interface BusinessCardProps {
  business: Business;
  initialAudit?: Audit;
  initialReport?: AiReport;
  index: number;
}

export function BusinessCard({ business, initialAudit, initialReport, index }: BusinessCardProps) {
  const [audit, setAudit] = useState<Audit | undefined>(initialAudit);
  const [report, setReport] = useState<AiReport | undefined>(initialReport);
  const [auditStatus, setAuditStatus] = useState<AuditStatus>(initialAudit ? 'done' : 'idle');
  const [reportStatus, setReportStatus] = useState<ReportStatus>(initialReport ? 'done' : 'idle');
  const [pdfLoading, setPdfLoading] = useState(false);

  const runGenerate = useCallback(async (auditId: string) => {
    setReportStatus('loading');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: auditId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.ai_report);
      setReportStatus('done');
    } catch {
      setReportStatus('error');
    }
  }, []);

  const runAudit = useCallback(async () => {
    setAuditStatus('loading');
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAudit(data.audit);
      setAuditStatus('done');
      runGenerate(data.audit.id);
    } catch {
      setAuditStatus('error');
    }
  }, [business.id, runGenerate]);

  // Auto-start audit if business has a website and no cached audit
  useEffect(() => {
    if (!business.website || initialAudit) return;
    const timer = setTimeout(() => {
      runAudit();
    }, index * 1500);
    return () => clearTimeout(timer);
  }, [business.website, initialAudit, index, runAudit]);

  const handleDownloadPdf = async () => {
    if (!audit) return;
    setPdfLoading(true);
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: audit.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${business.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
      {/* Card Header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4 border-b border-[var(--color-border)]">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] leading-tight">
            {business.name}
          </h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{business.address}</p>
          {business.phone && (
            <p className="text-sm text-[var(--color-text-tertiary)]">{business.phone}</p>
          )}
        </div>
        <div className="shrink-0">
          {business.website ? (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[var(--color-primary-600)] hover:underline break-all text-right block max-w-[200px]"
            >
              {business.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          ) : (
            <Badge variant="warning">No website</Badge>
          )}
        </div>
      </div>

      {/* Card Body */}
      {!business.website ? (
        <div className="px-6 py-5">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No website found — skipping audit.
          </p>
        </div>
      ) : (
        <div className="px-6 py-6 space-y-6">
          {/* Audit Scores */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-3">
              Audit Scores
            </p>
            {auditStatus === 'idle' && (
              <Button variant="outline" size="sm" onClick={runAudit}>
                Run Audit
              </Button>
            )}
            {auditStatus === 'loading' && (
              <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                <Spinner size="sm" />
                <span>Running audit…</span>
              </div>
            )}
            {auditStatus === 'error' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-500">Audit failed.</span>
                <Button variant="ghost" size="sm" onClick={runAudit}>
                  Retry
                </Button>
              </div>
            )}
            {auditStatus === 'done' && audit && <AuditScores audit={audit} />}
          </div>

          {/* AI Report */}
          {auditStatus === 'done' && (
            <div>
              {reportStatus === 'loading' && (
                <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                  <Spinner size="sm" />
                  <span>Generating AI report…</span>
                </div>
              )}
              {reportStatus === 'error' && audit && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-500">Report generation failed.</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runGenerate(audit.id)}
                  >
                    Retry
                  </Button>
                </div>
              )}
              {reportStatus === 'done' && report && <AiReportSection report={report} />}
            </div>
          )}
        </div>
      )}

      {/* Card Footer — download button */}
      {audit && report && (
        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <Button
            variant="primary"
            size="sm"
            onClick={handleDownloadPdf}
            isLoading={pdfLoading}
            disabled={pdfLoading}
          >
            {pdfLoading ? 'Generating PDF…' : '↓ Download PDF Report'}
          </Button>
        </div>
      )}
    </div>
  );
}
