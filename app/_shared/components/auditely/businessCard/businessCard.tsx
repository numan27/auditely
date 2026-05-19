// app/_shared/components/auditely/businessCard/businessCard.tsx

'use client';

import { useState, useCallback } from 'react';
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
}

function scoreTextColor(score: number) {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function BusinessCard({ business, initialAudit, initialReport }: BusinessCardProps) {
  const [audit, setAudit] = useState<Audit | undefined>(initialAudit);
  const [report, setReport] = useState<AiReport | undefined>(initialReport);
  const [auditStatus, setAuditStatus] = useState<AuditStatus>(initialAudit ? 'done' : 'idle');
  const [reportStatus, setReportStatus] = useState<ReportStatus>(initialReport ? 'done' : 'idle');
  const [email, setEmail] = useState<string | null>(business.email ?? null);
  const [emailCopied, setEmailCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  // Pre-loaded cards (from saved searches) start collapsed; freshly processed cards start expanded
  const [isExpanded, setIsExpanded] = useState(!(initialAudit && initialReport));

  const isCompleted = auditStatus === 'done' && reportStatus === 'done';

  const copyEmail = async () => {
    if (!email) return;
    await navigator.clipboard.writeText(email);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

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
      if (data.email) setEmail(data.email);
      setAuditStatus('done');
      runGenerate(data.audit.id);
    } catch {
      setAuditStatus('error');
    }
  }, [business.id, runGenerate]);

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
    <div className={`rounded-2xl bg-[var(--color-bg-secondary)] overflow-hidden transition-all ${
      isCompleted
        ? 'border-2 border-emerald-400 dark:border-emerald-600'
        : 'border border-[var(--color-border)]'
    }`}>
      {/* Card Header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4 border-b border-[var(--color-border)]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] leading-tight">
              {business.name}
            </h3>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Audited
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{business.address}</p>
          {business.phone && (
            <p className="text-sm text-[var(--color-text-tertiary)]">{business.phone}</p>
          )}
          {email && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <a
                href={`mailto:${email}`}
                className="text-sm text-[var(--color-primary-600)] hover:underline"
              >
                {email}
              </a>
              <button
                onClick={copyEmail}
                title="Copy email"
                className="cursor-pointer text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                {emailCopied ? (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            </div>
          )}

          {/* Mini score pills — visible only when collapsed */}
          {isCompleted && !isExpanded && audit && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-semibold ${scoreTextColor(audit.performance_score)}`}>
                Perf {audit.performance_score}
              </span>
              <span className="text-[var(--color-text-tertiary)] text-xs">·</span>
              <span className={`text-xs font-semibold ${scoreTextColor(audit.seo_score)}`}>
                SEO {audit.seo_score}
              </span>
              <span className="text-[var(--color-text-tertiary)] text-xs">·</span>
              <span className={`text-xs font-semibold ${scoreTextColor(audit.mobile_score)}`}>
                Mobile {audit.mobile_score}
              </span>
              <span className="text-[var(--color-text-tertiary)] text-xs">·</span>
              <span className={`text-xs font-semibold ${audit.ssl_valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                SSL {audit.ssl_valid ? '✓' : '✗'}
              </span>
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-start gap-2">
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

          {/* Accordion toggle — only on completed cards */}
          {isCompleted && (
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? 'Collapse' : 'Expand'}
              className="cursor-pointer mt-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Card Body — always visible for in-progress cards, collapsible when completed */}
      {(!isCompleted || isExpanded) && (
        <>
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
                  {reportStatus === 'idle' && audit && (
                    <Button variant="outline" size="sm" onClick={() => runGenerate(audit.id)}>
                      Generate AI Summary
                    </Button>
                  )}
                  {reportStatus === 'loading' && (
                    <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                      <Spinner size="sm" />
                      <span>Generating AI report…</span>
                    </div>
                  )}
                  {reportStatus === 'error' && audit && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-red-500">Report generation failed.</span>
                      <Button variant="ghost" size="sm" onClick={() => runGenerate(audit.id)}>
                        Retry
                      </Button>
                    </div>
                  )}
                  {reportStatus === 'done' && report && (
                    <AiReportSection report={report} />
                  )}
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
        </>
      )}
    </div>
  );
}
