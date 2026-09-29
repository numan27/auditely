// app/_shared/components/auditely/auditPanel/auditPanel.tsx

'use client';

import type { ReactNode } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { DownloadIcon, GaugeIcon, RefreshIcon } from '@/app/_shared/components/ui/icons/icons';
import { AuditScores } from '@/app/_shared/components/auditely/auditScores/auditScores';
import { AuditChecklist } from '@/app/_shared/components/auditely/auditChecklist/auditChecklist';
import { TechStack } from '@/app/_shared/components/auditely/techStack/techStack';
import { AiReportSection } from '@/app/_shared/components/auditely/aiReportSection/aiReportSection';
import type { useBusinessAudit } from '@/app/_shared/lib/hooks/useBusinessAudit';
import type { Business } from '@/app/_shared/lib/types/auditely';

interface AuditPanelProps {
  business: Business;
  state: ReturnType<typeof useBusinessAudit>;
}

const ROW = 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between';

const auditedOn = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const domainOf = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

function Status({ title, detail, busy }: { title: string; detail?: string; busy?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      {busy && <Spinner size="sm" />}
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
        {detail && <p className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">{detail}</p>}
      </div>
    </div>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }): ReactNode {
  return (
    <>
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshIcon size={14} />}>
        Try again
      </Button>
    </>
  );
}

/** The body of a business card: audit states, scores, findings and the AI report */
export function AuditPanel({ business, state }: AuditPanelProps) {
  const { audit, report, auditStatus, auditError, reportStatus, pdfLoading } = state;

  if (!business.website) {
    return (
      <p className="border-t border-[var(--color-border)] px-5 py-4 text-sm text-[var(--color-text-tertiary)] sm:px-6">
        No website listed, so there&apos;s nothing to audit. Reach them by phone or social media instead.
      </p>
    );
  }

  if (auditStatus !== 'done' || !audit) {
    return (
      <div className={`${ROW} border-t border-[var(--color-border)] px-5 py-4 sm:px-6`}>
        {auditStatus === 'loading' ? (
          <Status
            busy
            title={`Auditing ${domainOf(business.website)}…`}
            detail="Speed tests run on mobile and desktop, so this takes about a minute."
          />
        ) : auditStatus === 'error' ? (
          <Failed message={auditError ?? "The audit didn't finish."} onRetry={state.retryAudit} />
        ) : (
          <>
            <Status
              title="Not audited yet"
              detail="Checks speed, SEO, mobile, SSL and AI-search readiness, then drafts an outreach email."
            />
            <Button variant="primary" size="sm" onClick={() => state.runAudit()} leftIcon={<GaugeIcon size={14} />}>
              Run audit
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 border-t border-[var(--color-border)] px-5 py-5 sm:px-6 sm:py-6">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Audit scores
              <span className="ml-2 font-normal text-[var(--color-text-tertiary)]">{auditedOn(audit.created_at)}</span>
            </h4>
            <div className="flex items-center gap-2">
              {auditError && <span className="text-xs text-red-600 dark:text-red-400">{auditError}</span>}
              <Button
                variant="ghost"
                size="sm"
                onClick={state.reAudit}
                disabled={reportStatus === 'loading'}
                leftIcon={<RefreshIcon size={14} />}
              >
                Re-audit
              </Button>
            </div>
          </div>
          <AuditScores audit={audit} />
        </section>

        <AuditChecklist audit={audit} />
        <TechStack items={audit.checks?.tech} />

        <section className="border-t border-[var(--color-border)] pt-6">
          {reportStatus === 'done' && report ? (
            <AiReportSection report={report} />
          ) : (
            <div className={ROW}>
              {reportStatus === 'loading' ? (
                <Status busy title="Writing the summary and outreach email…" />
              ) : reportStatus === 'error' ? (
                <Failed message="Couldn't write the AI summary." onRetry={() => state.generateReport(audit.id)} />
              ) : (
                <>
                  <Status title="AI summary" detail="A plain-English summary and an outreach email based on this audit." />
                  <Button variant="outline" size="sm" onClick={() => state.generateReport(audit.id)}>
                    Write summary
                  </Button>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {report && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-5 py-3 sm:px-6">
          <p className="text-sm text-[var(--color-text-tertiary)]">A branded PDF of this audit, ready to send.</p>
          <Button
            variant="primary"
            size="sm"
            onClick={state.downloadPdf}
            isLoading={pdfLoading}
            leftIcon={<DownloadIcon size={14} />}
          >
            {pdfLoading ? 'Preparing PDF…' : 'Download PDF report'}
          </Button>
        </div>
      )}
    </>
  );
}
