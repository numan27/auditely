// app/_shared/components/auditely/auditScores/auditScores.tsx

import type { Audit } from '@/app/_shared/lib/types/auditely';
import { scoreTone, topLighthouseIssues, type ScoreTone } from '@/app/_shared/lib/audit/reportData';

const SSL_EXPIRY_WARN_DAYS = 30;

const TONE_CLASSES: Record<ScoreTone, { value: string; bg: string }> = {
  good: { value: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  ok: { value: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  poor: { value: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40' },
  none: { value: 'text-[var(--color-text-tertiary)]', bg: 'bg-[var(--color-bg-primary)]' },
};

interface TileProps {
  label: string;
  value: string;
  tone: ScoreTone;
  note?: string;
  reason?: string;
}

function Tile({ label, value, tone, note, reason }: TileProps) {
  const classes = TONE_CLASSES[tone];
  return (
    <div title={reason} className={`flex flex-col items-center gap-1 rounded-xl px-3 py-4 ${classes.bg}`}>
      <span className={`text-xl font-bold tabular-nums ${classes.value}`}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </span>
      {note && <span className={`text-[10px] ${classes.value}`}>{note}</span>}
    </div>
  );
}

// `== null` also covers undefined (rows written before the GEO/AEO columns existed)
function ScoreTile({ label, score, reason }: { label: string; score: number | null | undefined; reason?: string }) {
  return (
    <Tile
      label={label}
      value={score == null ? '—' : String(score)}
      tone={scoreTone(score)}
      reason={score == null ? (reason ?? 'Not measured') : undefined}
    />
  );
}

function SslTile({ audit }: { audit: Audit }) {
  const ssl = audit.checks?.ssl;
  if (audit.ssl_valid === null) return <Tile label="SSL" value="—" tone="none" reason={ssl?.error ?? 'Not measured'} />;
  if (!audit.ssl_valid) return <Tile label="SSL" value="✗" tone="poor" reason={ssl?.error} />;

  const days = ssl?.daysToExpiry ?? null;
  const expiringSoon = days !== null && days < SSL_EXPIRY_WARN_DAYS;
  return (
    <Tile label="SSL" value="✓" tone={expiringSoon ? 'ok' : 'good'} note={expiringSoon ? `expires in ${days}d` : undefined} />
  );
}

function psiReason(audit: Audit, strategy: 'mobile' | 'desktop'): string | undefined {
  const status = audit.checks?.psi?.[strategy];
  return status && status !== 'ok' ? `PageSpeed failed: ${status}` : undefined;
}

function KeyIssues({ rawJson }: { rawJson: Record<string, unknown> }) {
  const issues = topLighthouseIssues(rawJson, 4);
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

export function AuditScores({ audit }: { audit: Audit }) {
  const siteReason = audit.checks?.site?.reason;
  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        <ScoreTile label="Performance" score={audit.performance_score} reason={psiReason(audit, 'desktop')} />
        <ScoreTile label="SEO" score={audit.seo_score} reason={psiReason(audit, 'mobile')} />
        <ScoreTile label="Mobile" score={audit.mobile_score} reason={psiReason(audit, 'mobile')} />
        <SslTile audit={audit} />
        <ScoreTile label="GEO" score={audit.geo_score} reason={siteReason} />
        <ScoreTile label="AEO" score={audit.aeo_score} reason={siteReason} />
      </div>
      <KeyIssues rawJson={audit.raw_json} />
    </div>
  );
}
