// app/_shared/components/auditely/auditScores/auditScores.tsx

import type { Audit } from '@/app/_shared/lib/types/auditely';

interface ScoreRingProps {
  score: number;
  label: string;
}

function ScoreRing({ score, label }: ScoreRingProps) {
  const valueColor =
    score >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
  const bgColor =
    score >= 80
      ? 'bg-emerald-50 dark:bg-emerald-950/40'
      : score >= 50
        ? 'bg-amber-50 dark:bg-amber-950/40'
        : 'bg-red-50 dark:bg-red-950/40';

  return (
    <div className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-4 flex-1 ${bgColor}`}>
      <span className={`text-xl font-bold tabular-nums ${valueColor}`}>{score}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </span>
    </div>
  );
}

interface SslBadgeProps {
  valid: boolean;
}

function SslBadge({ valid }: SslBadgeProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-4 flex-1 ${
        valid
          ? 'bg-emerald-50 dark:bg-emerald-950/40'
          : 'bg-red-50 dark:bg-red-950/40'
      }`}
    >
      <span
        className={`text-xl font-bold ${
          valid
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400'
        }`}
      >
        {valid ? '✓' : '✗'}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        SSL
      </span>
    </div>
  );
}

type KeyAudit = { score: number | null; title: string; displayValue?: string };

function KeyIssues({ rawJson }: { rawJson: Record<string, unknown> }) {
  const mobile = rawJson?.mobile as { keyAudits?: Record<string, KeyAudit> } | undefined;
  const audits = mobile?.keyAudits ?? {};

  const issues = Object.values(audits)
    .filter((a): a is KeyAudit & { score: number } => typeof a.score === 'number' && a.score < 0.9)
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);

  if (issues.length === 0) return null;

  return (
    <div className="mt-4 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
        Top Issues
      </p>
      <ul className="space-y-1.5">
        {issues.map((issue, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
            <span className="mt-0.5 shrink-0 text-xs text-red-500">●</span>
            <span>
              {issue.title}
              {issue.displayValue && (
                <span className="ml-1 text-xs text-[var(--color-text-tertiary)]">({issue.displayValue})</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface AuditScoresProps {
  audit: Audit;
}

export function AuditScores({ audit }: AuditScoresProps) {
  return (
    <div>
      <div className="flex gap-2.5">
        <ScoreRing score={audit.performance_score} label="Performance" />
        <ScoreRing score={audit.seo_score} label="SEO" />
        <ScoreRing score={audit.mobile_score} label="Mobile" />
        <SslBadge valid={audit.ssl_valid} />
      </div>
      <KeyIssues rawJson={audit.raw_json} />
    </div>
  );
}
