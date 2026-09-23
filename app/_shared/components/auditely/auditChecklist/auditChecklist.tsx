// app/_shared/components/auditely/auditChecklist/auditChecklist.tsx

import type { Audit } from '@/app/_shared/lib/types/auditely';
import type { Finding } from '@/app/_shared/lib/audit/types';
import { sortFindings } from '@/app/_shared/lib/audit/reportData';

const STATUS_STYLES: Record<Finding['status'], { icon: string; className: string }> = {
  fail: { icon: '✗', className: 'text-red-500' },
  warn: { icon: '!', className: 'text-amber-500' },
  pass: { icon: '✓', className: 'text-emerald-500' },
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
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
          {title}
        </p>
        {typeof score === 'number' && (
          <span className="text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">{score}/100</span>
        )}
      </div>
      <ul className="space-y-1.5">
        {sortFindings(findings).map((finding) => {
          const style = STATUS_STYLES[finding.status];
          return (
            <li key={finding.id} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
              <span className={`mt-0.5 w-3 shrink-0 text-xs font-bold ${style.className}`}>{style.icon}</span>
              <span>
                {finding.label}
                {finding.detail && (
                  <span className="ml-1 text-xs text-[var(--color-text-tertiary)]">({finding.detail})</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** GEO / AEO findings, plus HTML-based SEO basics when PageSpeed's SEO score is missing. */
export function AuditChecklist({ audit }: { audit: Audit }) {
  const { geo, aeo, seo, site } = audit.checks ?? {};
  const showSeoBasics = audit.seo_score === null && !!seo;
  if (!geo && !aeo && !showSeoBasics) {
    return site?.reason ? (
      <p className="text-sm text-[var(--color-text-tertiary)]">Couldn&apos;t read site: {site.reason}</p>
    ) : null;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {geo && <FindingGroup title="GEO — AI search visibility" score={audit.geo_score} findings={geo.findings} />}
      {aeo && <FindingGroup title="AEO — answer-engine readiness" score={audit.aeo_score} findings={aeo.findings} />}
      {showSeoBasics && seo && <FindingGroup title="SEO basics (from page HTML)" findings={seo.findings} />}
    </div>
  );
}
