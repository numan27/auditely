// app/_shared/components/auditely/auditScores/auditScores.tsx

import type { AuditFields } from '@/app/_shared/lib/types/auditely';
import { ShieldAlertIcon } from '@/app/_shared/components/ui/icons/icons';
import { scoreTone, siteBlocked, siteNotice, topLighthouseIssues, unreadSiteReason, type ScoreTone } from '@/app/_shared/lib/audit/reportData';

const SSL_EXPIRY_WARN_DAYS = 30;

const TONE_CLASSES: Record<ScoreTone, { text: string; meter: string }> = {
  good: { text: 'text-emerald-600 dark:text-emerald-400', meter: 'bg-emerald-500' },
  ok: { text: 'text-amber-600 dark:text-amber-400', meter: 'bg-amber-500' },
  poor: { text: 'text-red-600 dark:text-red-400', meter: 'bg-red-500' },
  none: { text: 'text-[var(--color-text-tertiary)]', meter: 'bg-transparent' },
};

interface TileProps {
  label: string;
  value: string;
  tone: ScoreTone;
  /** How full the meter is, 0–100 */
  fill: number;
  note?: string;
  reason?: string;
}

function Tile({ label, value, tone, fill, note, reason }: TileProps) {
  const classes = TONE_CLASSES[tone];
  const isWord = value.length > 3;
  return (
    <div title={reason} className="flex flex-col rounded-xl bg-[var(--color-bg-primary)] px-3.5 pb-3 pt-3">
      <div
        className={`font-display font-semibold leading-none tabular-nums ${isWord ? 'pt-1.5 text-xl' : 'text-[1.75rem]'} ${classes.text}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-xs font-medium text-[var(--color-text-secondary)]">{label}</div>
      {/* Pinned to the bottom so meters line up across tiles */}
      <div className="mt-auto pt-2.5" aria-hidden>
        <div className="h-1 overflow-hidden rounded-full bg-[var(--color-border)]">
          <div className={`h-full rounded-full ${classes.meter}`} style={{ width: `${fill}%` }} />
        </div>
      </div>
      {note && <div className={`mt-1.5 text-[11px] font-medium ${classes.text}`}>{note}</div>}
    </div>
  );
}

// `== null` also covers undefined (rows written before the GEO/AEO columns existed)
function ScoreTile({ label, score, reason, blocked }: { label: string; score: number | null | undefined; reason?: string; blocked?: boolean }) {
  return (
    <Tile
      label={label}
      value={score == null ? (blocked ? 'Blocked' : '—') : String(score)}
      tone={scoreTone(score)}
      fill={score ?? 0}
      reason={score == null ? (reason ?? 'Not measured') : undefined}
    />
  );
}

function SslTile({ audit }: { audit: AuditFields }) {
  const ssl = audit.checks?.ssl;
  if (audit.ssl_valid === null) {
    return <Tile label="SSL" value="—" tone="none" fill={0} reason={ssl?.error ?? 'Not measured'} />;
  }
  if (!audit.ssl_valid) return <Tile label="SSL" value="Invalid" tone="poor" fill={100} reason={ssl?.error} />;

  const days = ssl?.daysToExpiry ?? null;
  const expiringSoon = days !== null && days < SSL_EXPIRY_WARN_DAYS;
  return (
    <Tile
      label="SSL"
      value="Valid"
      tone={expiringSoon ? 'ok' : 'good'}
      fill={100}
      note={expiringSoon ? `Expires in ${days} days` : undefined}
    />
  );
}

function psiReason(audit: AuditFields, strategy: 'mobile' | 'desktop'): string | undefined {
  const status = audit.checks?.psi?.[strategy];
  return status && status !== 'ok' ? `PageSpeed failed: ${status}` : undefined;
}

/** Why GEO, AEO and lead capture have no scores: the site couldn't be read */
function SiteNotice({ reason }: { reason: string }) {
  const { title, body } = siteNotice(reason);
  return (
    <div role="note" className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <ShieldAlertIcon size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">{body}</p>
      </div>
    </div>
  );
}

function KeyIssues({ rawJson }: { rawJson: Record<string, unknown> }) {
  const issues = topLighthouseIssues(rawJson, 4);
  if (issues.length === 0) return null;

  return (
    <div className="mt-5">
      <h4 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Biggest issues on mobile</h4>
      <ul className="space-y-1.5">
        {issues.map((issue, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--color-text-secondary)]">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
            <span>
              {issue.title}
              {issue.displayValue && (
                <span className="ml-1.5 tabular-nums text-[var(--color-text-tertiary)]">{issue.displayValue}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuditScores({ audit }: { audit: AuditFields }) {
  const siteReason = audit.checks?.site?.reason;
  const unread = unreadSiteReason(audit.checks);
  const blocked = siteBlocked(audit.checks);
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <ScoreTile label="Performance" score={audit.performance_score} reason={psiReason(audit, 'desktop')} />
        <ScoreTile label="SEO" score={audit.seo_score} reason={psiReason(audit, 'mobile')} />
        <ScoreTile label="Mobile" score={audit.mobile_score} reason={psiReason(audit, 'mobile')} />
        <SslTile audit={audit} />
        <ScoreTile label="GEO" score={audit.geo_score} reason={siteReason} blocked={blocked} />
        <ScoreTile label="AEO" score={audit.aeo_score} reason={siteReason} blocked={blocked} />
        <ScoreTile label="Lead capture" score={audit.lead_score} reason={siteReason} blocked={blocked} />
      </div>
      {unread && <SiteNotice reason={unread} />}
      <KeyIssues rawJson={audit.raw_json} />
    </div>
  );
}
