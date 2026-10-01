// app/_shared/components/auditely/reportActions/reportActions.tsx

'use client';

import { Button } from '@/app/_shared/components/ui/button/button';
import { DownloadIcon } from '@/app/_shared/components/ui/icons/icons';
import type { useCrmSend } from '@/app/_shared/lib/hooks/useCrmSend';
import type { useBusinessAudit } from '@/app/_shared/lib/hooks/useBusinessAudit';

interface ReportActionsProps {
  state: ReturnType<typeof useBusinessAudit>;
  crm: ReturnType<typeof useCrmSend>;
}

const sentOn = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Once the AI report exists: send the lead to HubSpot, or download its PDF */
export function ReportActions({ state, crm }: ReportActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-5 py-3 sm:px-6">
      <p className="text-sm text-[var(--color-text-tertiary)]">
        {crm.error ? (
          <span className="text-red-600 dark:text-red-400">{crm.error}</span>
        ) : crm.sentAt ? (
          `Sent to HubSpot · ${sentOn(crm.sentAt)}`
        ) : (
          'A branded PDF of this audit, ready to send.'
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={crm.send} isLoading={crm.sending}>
          {crm.sending ? 'Sending…' : crm.sentAt ? 'Send again' : 'Send to HubSpot'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={state.downloadPdf}
          isLoading={state.pdfLoading}
          leftIcon={<DownloadIcon size={14} />}
        >
          {state.pdfLoading ? 'Preparing PDF…' : 'Download PDF report'}
        </Button>
      </div>
    </div>
  );
}
