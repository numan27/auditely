// app/_shared/components/auditely/settingsView/freeAuditsSection.tsx

'use client';

// The owner's view of the home page's free audit: today's count against the
// daily cap, and each audit's site, time and whether its visitor kept it.

import { useSyncExternalStore } from 'react';
import { Section } from '@/app/_shared/components/auditely/settingsView/settingsSection';
import type { FreeAuditListing } from '@/app/_shared/lib/freeAudit/freeAuditStore';

export interface FreeAuditsSummary {
  state: 'on' | 'off' | 'unavailable';
  /** FREE_AUDIT_DAILY_CAP while free audits are on */
  cap: number | null;
  /** The settings that stop free audits running, while they're unavailable */
  missing: string[];
  /** Since midnight UTC, newest first; null when they couldn't be read */
  today: FreeAuditListing[] | null;
}

const host = (website: string) => {
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
};

const STATUS = { running: 'Running', kept: 'Kept', notKept: 'Not kept' };
const statusOf = ({ status, kept }: FreeAuditListing) =>
  status === 'running' ? STATUS.running : kept ? STATUS.kept : STATUS.notKept;

const noSubscribe = () => () => {};

/** The browser's own time; the server, which can't know the owner's zone, says UTC */
function LocalTime({ iso }: { iso: string }) {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const at = new Date(iso);
  const time = inBrowser
    ? at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : `${at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} UTC`;
  return <time dateTime={iso}>{time}</time>;
}

function headline({ state, cap, missing, today }: FreeAuditsSummary): string | null {
  if (state === 'off') return 'Free audits are off.';
  if (state === 'unavailable') return `Free audits aren't set up: ${missing.join(', ')}.`;
  if (!today) return null;
  return `${today.length.toLocaleString('en-US')} of ${(cap ?? 0).toLocaleString('en-US')} free audits used today.`;
}

export function FreeAuditsSection({ freeAudits }: { freeAudits: FreeAuditsSummary }) {
  const { state, today } = freeAudits;
  const line = headline(freeAudits);
  return (
    <Section
      id="free-audits"
      title="Free audits"
      lead={<p>Visitors to the home page can audit one website without signing up. The count starts again at midnight UTC.</p>}
    >
      <div className="space-y-4">
        {line && <p className="text-sm font-medium text-[var(--color-text-primary)]">{line}</p>}
        {!today ? (
          <p className="text-sm text-[var(--color-error)]" role="alert">
            Couldn&apos;t load today&apos;s free audits. Refresh to try again.
          </p>
        ) : today.length ? (
          <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {today.map((audit, i) => (
              <li key={`${audit.createdAt}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-2.5 text-sm">
                <span className="truncate text-[var(--color-text-primary)]">{host(audit.website)}</span>
                <span className="tabular-nums text-[var(--color-text-tertiary)]">
                  <LocalTime iso={audit.createdAt} />
                </span>
                <span className="w-16 text-right text-[var(--color-text-secondary)]">{statusOf(audit)}</span>
              </li>
            ))}
          </ul>
        ) : state === 'on' ? (
          <p className="text-sm text-[var(--color-text-secondary)]">No free audits yet today.</p>
        ) : null}
      </div>
    </Section>
  );
}
