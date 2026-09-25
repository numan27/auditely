// app/_shared/components/auditely/businessCard/businessCard.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { Badge } from '@/app/_shared/components/ui/badge/badge';
import { AuditScores } from '@/app/_shared/components/auditely/auditScores/auditScores';
import { AuditChecklist } from '@/app/_shared/components/auditely/auditChecklist/auditChecklist';
import { AiReportSection } from '@/app/_shared/components/auditely/aiReportSection/aiReportSection';
import { BusinessEmail } from '@/app/_shared/components/auditely/businessEmail/businessEmail';
import { ContactLinks } from '@/app/_shared/components/auditely/contactLinks/contactLinks';
import { useBusinessAudit } from '@/app/_shared/lib/hooks/useBusinessAudit';
import { isOutdatedAudit } from '@/app/_shared/lib/audit/types';
import { scoreTone, type ScoreTone } from '@/app/_shared/lib/audit/reportData';
import type { Business, Audit, AiReport } from '@/app/_shared/lib/types/auditely';

interface BusinessCardProps {
  business: Business;
  initialAudit?: Audit;
  initialReport?: AiReport;
}

const PILL_TONES: Record<ScoreTone, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  ok: 'text-amber-600 dark:text-amber-400',
  poor: 'text-red-600 dark:text-red-400',
  none: 'text-[var(--color-text-tertiary)]',
};

// Compact score summary shown when a completed card is collapsed
function ScorePills({ audit }: { audit: Audit }) {
  const scores: [string, number | null][] = [
    ['Perf', audit.performance_score],
    ['SEO', audit.seo_score],
    ['Mobile', audit.mobile_score],
    ['GEO', audit.geo_score],
    ['AEO', audit.aeo_score],
  ];
  const ssl = audit.ssl_valid;
  const sslTone: ScoreTone = ssl === null ? 'none' : ssl ? 'good' : 'poor';

  return (
    <div className="flex items-center gap-x-3 gap-y-1 mt-2 flex-wrap text-xs font-semibold">
      {scores.map(([label, score]) => (
        <span key={label} className={PILL_TONES[scoreTone(score)]}>
          {label} {score ?? '—'}
        </span>
      ))}
      <span className={PILL_TONES[sslTone]}>SSL {ssl === null ? '—' : ssl ? '✓' : '✗'}</span>
    </div>
  );
}

export function BusinessCard({ business, initialAudit, initialReport }: BusinessCardProps) {
  const {
    audit,
    report,
    auditStatus,
    auditError,
    reportStatus,
    email,
    setEmail,
    pdfLoading,
    runAudit,
    reAudit,
    retryAudit,
    generateReport,
    downloadPdf,
  } = useBusinessAudit(business, initialAudit, initialReport);
  // Pre-loaded cards (from saved searches) start collapsed; freshly processed cards start expanded
  const [isExpanded, setIsExpanded] = useState(!(initialAudit && initialReport));

  const isCompleted = auditStatus === 'done' && reportStatus === 'done';
  const isOutdated = auditStatus === 'done' && !!audit && isOutdatedAudit(audit.engine_version);

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
            {isOutdated && (
              <Badge variant="warning" size="sm">Outdated</Badge>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{business.address}</p>
          {business.phone && (
            <a
              href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}
              className="block w-fit text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-primary-600)] hover:underline"
            >
              {business.phone}
            </a>
          )}
          <BusinessEmail
            email={email}
            website={business.website}
            businessId={business.id}
            onFound={setEmail}
          />
          <ContactLinks contactPage={business.contact_page} socials={business.socials} />

          {isCompleted && !isExpanded && audit && <ScorePills audit={audit} />}
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
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
                    Audit Scores
                  </p>
                  {auditStatus === 'done' && (
                    <div className="flex items-center gap-2">
                      {auditError && <span className="text-xs text-red-500">{auditError}</span>}
                      <Button variant="ghost" size="sm" onClick={reAudit} disabled={reportStatus === 'loading'}>
                        Re-audit
                      </Button>
                    </div>
                  )}
                </div>
                {auditStatus === 'idle' && (
                  <Button variant="outline" size="sm" onClick={() => runAudit()}>
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
                    <span className="text-sm text-red-500">{auditError ?? 'Audit failed.'}</span>
                    <Button variant="ghost" size="sm" onClick={retryAudit}>
                      Retry
                    </Button>
                  </div>
                )}
                {auditStatus === 'done' && audit && (
                  <div className="space-y-6">
                    <AuditScores audit={audit} />
                    <AuditChecklist audit={audit} />
                  </div>
                )}
              </div>

              {/* AI Report */}
              {auditStatus === 'done' && (
                <div>
                  {reportStatus === 'idle' && audit && (
                    <Button variant="outline" size="sm" onClick={() => generateReport(audit.id)}>
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
                      <Button variant="ghost" size="sm" onClick={() => generateReport(audit.id)}>
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
                onClick={downloadPdf}
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
