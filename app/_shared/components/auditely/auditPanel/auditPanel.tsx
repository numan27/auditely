// app/_shared/components/auditely/auditPanel/auditPanel.tsx

'use client';

import type { ReactNode } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { GaugeIcon, RefreshIcon } from '@/app/_shared/components/ui/icons/icons';
import { AuditScan } from '@/app/_shared/components/auditely/auditScan/auditScan';
import { AuditScores } from '@/app/_shared/components/auditely/auditScores/auditScores';
import { AuditChecklist } from '@/app/_shared/components/auditely/auditChecklist/auditChecklist';
import { TechStack } from '@/app/_shared/components/auditely/techStack/techStack';
import { AiReportSection } from '@/app/_shared/components/auditely/aiReportSection/aiReportSection';
import { ReportActions } from '@/app/_shared/components/auditely/reportActions/reportActions';
import type { useBusinessAudit } from '@/app/_shared/lib/hooks/useBusinessAudit';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import type { useCrmSend } from '@/app/_shared/lib/hooks/useCrmSend';
import type { useEmailSend } from '@/app/_shared/lib/hooks/useEmailSend';
import type { Business } from '@/app/_shared/lib/types/auditely';

interface AuditPanelProps {
  business: Business;
  state: ReturnType<typeof useBusinessAudit>;
  /** "Send to HubSpot", owned by the card so it survives collapsing */
  crm: ReturnType<typeof useCrmSend>;
  /** "Send email", owned by the card for the same reason */
  mail: ReturnType<typeof useEmailSend>;
  /** Also offer the report's Upwork version (websites added by URL) */
  upworkPdf?: boolean;
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
export function AuditPanel({ business, state, crm, mail, upworkPdf }: AuditPanelProps) {
  const demo = useDemo();
  const { audit, report, auditStatus, auditError, reportStatus, queued } = state;

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
          <AuditScan
            domain={domainOf(business.website)}
            title={demo ? `Replaying the saved audit of ${domainOf(business.website)}…` : `Auditing ${domainOf(business.website)}…`}
            detail={
              demo
                ? 'A live audit takes about a minute; this replay is shortened.'
                : 'Speed tests run on mobile and desktop, so this takes about a minute.'
            }
          />
        ) : auditStatus === 'error' ? (
          <Failed message={auditError ?? "The audit didn't finish."} onRetry={state.retryAudit} />
        ) : queued ? (
          <Status title="Queued for audit" detail="Audit all is working through the list, a few sites at a time." />
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
                // Queued: "Audit all" is about to write this audit's summary
                disabled={reportStatus === 'loading' || queued || state.rewriting}
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
            <AiReportSection
              report={report}
              businessName={business.name}
              audit={audit}
              emailedAt={mail.sentAt}
              request={business.request}
              // The demo's summaries are the saved sample's: nothing to write again
              onRewrite={demo ? undefined : () => state.rewriteReport(audit.id)}
              rewriting={state.rewriting}
              rewriteError={state.rewriteError}
            />
          ) : (
            <div className={ROW}>
              {reportStatus === 'loading' ? (
                <Status busy title={demo ? 'Replaying the saved summary and outreach email…' : 'Writing the summary and outreach email…'} />
              ) : reportStatus === 'error' ? (
                <Failed message="Couldn't write the AI summary." onRetry={() => state.generateReport(audit.id)} />
              ) : queued ? (
                <Status title="AI summary queued" detail="Audit all will write it shortly." />
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

      {report && <ReportActions businessName={business.name} state={state} crm={crm} mail={mail} upworkPdf={upworkPdf} request={business.request} />}
    </>
  );
}
