// app/_shared/components/auditely/auditChecklist/auditChecklist.tsx

import type { ReactNode } from 'react';
import type { AuditFields } from '@/app/_shared/lib/types/auditely';
import type { Finding } from '@/app/_shared/lib/audit/types';
import { sortFindings } from '@/app/_shared/lib/audit/reportData';
import { CheckIcon, XIcon } from '@/app/_shared/components/ui/icons/icons';

const STATUS_STYLES: Record<Finding['status'], { icon: ReactNode; className: string; label: string }> = {
  fail: {
    icon: <XIcon size={10} strokeWidth={3} />,
    className: 'bg-red-500/15 text-red-600 dark:text-red-400',
    label: 'Fail',
  },
  warn: {
    icon: <span className="text-[10px] font-bold leading-none">!</span>,
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    label: 'Warning',
  },
  pass: {
    icon: <CheckIcon size={10} strokeWidth={3} />,
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    label: 'Pass',
  },
};

interface FindingGroupProps {
  title: string;
  score?: number | null;
  findings: Finding[];
}

function FindingGroup({ title, score, findings }: FindingGroupProps) {
  if (findings.length === 0) return null;
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h4>
        {typeof score === 'number' && (
          <span className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-[var(--color-text-tertiary)]">{score} / 100</span>
        )}
      </div>
      <ul className="space-y-2">
        {sortFindings(findings).map((finding) => {
          const style = STATUS_STYLES[finding.status];
          return (
            <li key={finding.id} className="flex items-start gap-2.5 text-sm text-[var(--color-text-secondary)]">
              <span
                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${style.className}`}
                role="img"
                aria-label={style.label}
              >
                {style.icon}
              </span>
              <span>
                {finding.label}
                {finding.detail && (
                  <span className="mt-0.5 block text-xs text-[var(--color-text-tertiary)]">{finding.detail}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** GEO / AEO / lead capture findings, plus HTML-based SEO basics when PageSpeed's SEO score is missing. */
export function AuditChecklist({ audit }: { audit: AuditFields }) {
  const { geo, aeo, seo, lead } = audit.checks ?? {};
  const showSeoBasics = audit.seo_score === null && !!seo;
  // A site that couldn't be read says why under the scores (AuditScores)
  if (!geo && !aeo && !lead && !showSeoBasics) return null;

  return (
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
      {geo && <FindingGroup title="Visible to AI search (GEO)" score={audit.geo_score} findings={geo.findings} />}
      {aeo && <FindingGroup title="Ready for answer engines (AEO)" score={audit.aeo_score} findings={aeo.findings} />}
      {lead && <FindingGroup title="Can visitors reach you? (Lead capture)" score={audit.lead_score} findings={lead.findings} />}
      {showSeoBasics && seo && <FindingGroup title="SEO basics, read from the page" findings={seo.findings} />}
    </div>
  );
}
