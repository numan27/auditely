// app/_shared/components/landing/freeAuditReport.tsx

// The report card on the landing page: the sample report and a visitor's free
// audit look the same, built from the app's own score tiles and checks.

import type { ReactNode } from 'react';
import { AuditScores } from '@/app/_shared/components/auditely/auditScores/auditScores';
import { AuditChecklist } from '@/app/_shared/components/auditely/auditChecklist/auditChecklist';
import { cardClasses } from '@/app/_shared/components/landing/landingStyles';
import type { AuditFields } from '@/app/_shared/lib/types/auditely';

export interface FreeAuditReportProps {
  name: string;
  website: string;
  audit: AuditFields;
  report: { summary: string; improvements: string[] } | null;
  /** "Sample report" or "Audited just now" */
  badge: string;
  /** The badge as a pill (the sample), or as plain text (a free audit) */
  pill?: boolean;
  /** The card's last line, under a rule */
  footer?: ReactNode;
}

const bareHost = (website: string) => new URL(website).hostname.replace(/^www\./, '');

export function FreeAuditReport({ name, website, audit, report, badge, pill = false, footer }: FreeAuditReportProps) {
  // A free audit is named by its host, so its link shows the whole address
  const linkText = bareHost(website) === name ? website : bareHost(website);
  return (
    <article className={`${cardClasses} p-5 min-[601px]:p-8`}>
      <div className="flex flex-col items-start justify-between gap-4 min-[601px]:flex-row">
        <div className="min-w-0">
          <h3 className="font-display text-[26px] font-semibold tracking-tight text-[var(--color-text-primary)]">{name}</h3>
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-[15px] text-[var(--color-primary-600)] hover:underline"
          >
            {linkText}
          </a>
        </div>
        {pill ? (
          <span className="whitespace-nowrap rounded-full bg-[var(--color-primary-600)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-primary-600)]">
            {badge}
          </span>
        ) : (
          <span className="whitespace-nowrap text-sm text-[var(--color-text-tertiary)]">{badge}</span>
        )}
      </div>

      <div className="mt-6">
        <AuditScores audit={audit} />
      </div>

      {report && (
        <div className="mt-8 grid gap-8 border-t border-[var(--color-border)] pt-7 min-[961px]:grid-cols-[1.35fr_1fr] min-[961px]:gap-10">
          <div>
            <h4 className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">In plain English</h4>
            <p className="text-[17px] leading-relaxed text-[var(--color-text-primary)]">{report.summary}</p>
          </div>
          {report.improvements.length > 0 && (
            <div>
              <h4 className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">What to fix first</h4>
              <ol className="space-y-3">
                {report.improvements.map((item, i) => (
                  <li key={i} className="grid grid-cols-[28px_1fr] gap-3 text-[15.5px] leading-normal text-[var(--color-text-primary)]">
                    <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-[var(--color-primary-600)]/10 text-[13px] font-semibold tabular-nums text-[var(--color-primary-600)]">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 border-t border-[var(--color-border)] pt-7">
        <AuditChecklist audit={audit} />
      </div>

      {footer && <div className="mt-7 border-t border-[var(--color-border)] pt-5 text-[15px]">{footer}</div>}
    </article>
  );
}
