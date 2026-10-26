// app/_shared/components/auditely/requestSummary/requestSummary.tsx

'use client';

import { ClockIcon, MailIcon } from '@/app/_shared/components/ui/icons/icons';
import { requestStatus, type RequestStatus } from '@/app/_shared/lib/utils/requestDue';
import type { AuditRequest } from '@/app/_shared/lib/types/auditely';

const STATUS_TONES: Record<RequestStatus['state'], string> = {
  replied: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  due: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  overdue: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

const requestedOn = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** In the card's header, so a closed card says it too: when the reply is due, or when it went */
export function RequestStatusPill({ request, emailedAt }: { request: AuditRequest; emailedAt: string | null }) {
  const status = requestStatus(request.requested_at, emailedAt);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONES[status.state]}`}>
      {status.state === 'replied' ? <MailIcon size={11} strokeWidth={2.5} /> : <ClockIcon size={11} strokeWidth={2.5} />}
      {status.label}
    </span>
  );
}

/** Who asked for this audit on devartventures.com, and what they told the form */
export function RequestSummary({ request }: { request: AuditRequest }) {
  const details = [request.business_type, request.main_concern && `Main concern: ${request.main_concern}`].filter(Boolean);
  return (
    <div className="mt-3 rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
      <p>
        Requested by <span className="font-medium text-[var(--color-text-primary)]">{request.name}</span> on{' '}
        {requestedOn(request.requested_at)}
      </p>
      {details.length > 0 && <p className="text-[var(--color-text-tertiary)]">{details.join(' · ')}</p>}
    </div>
  );
}
