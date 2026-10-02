// app/_shared/components/auditely/reportActions/reportActions.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { DownloadIcon, MailIcon } from '@/app/_shared/components/ui/icons/icons';
import { SendEmailModal } from '@/app/_shared/components/auditely/sendEmailModal/sendEmailModal';
import { outreachDraft, type OutreachDraft } from '@/app/_shared/lib/email/outreach';
import type { useCrmSend } from '@/app/_shared/lib/hooks/useCrmSend';
import type { useEmailSend } from '@/app/_shared/lib/hooks/useEmailSend';
import type { useBusinessAudit } from '@/app/_shared/lib/hooks/useBusinessAudit';

interface ReportActionsProps {
  businessName: string;
  state: ReturnType<typeof useBusinessAudit>;
  crm: ReturnType<typeof useCrmSend>;
  mail: ReturnType<typeof useEmailSend>;
}

const sentOn = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Once the AI report exists: email the lead, send it to HubSpot, or download its PDF */
export function ReportActions({ businessName, state, crm, mail }: ReportActionsProps) {
  const [composing, setComposing] = useState(false);
  const { email, report } = state;

  const openComposer = () => {
    mail.clearError();
    setComposing(true);
  };
  const sendEmail = async (draft: OutreachDraft) => {
    if (await mail.send(draft)) setComposing(false);
  };

  const problem = crm.error ?? mail.warning;
  const done = [mail.sentAt && `Emailed ${sentOn(mail.sentAt)}`, crm.sentAt && `Sent to HubSpot ${sentOn(crm.sentAt)}`].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-5 py-3 sm:px-6">
      <p className="text-sm text-[var(--color-text-tertiary)]">
        {problem ? (
          <span className="text-red-600 dark:text-red-400">{problem}</span>
        ) : done.length ? (
          done.join(' · ')
        ) : (
          'A branded PDF of this audit, ready to send.'
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={openComposer}
          disabled={!email}
          title={email ? undefined : 'No email address found for this business'}
          leftIcon={<MailIcon size={14} />}
        >
          {mail.sentAt ? 'Email again' : 'Send email'}
        </Button>
        <Button variant="outline" size="sm" onClick={crm.send} isLoading={crm.sending}>
          {crm.sending ? 'Sending…' : crm.sentAt ? 'Update HubSpot' : 'Send to HubSpot'}
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

      {composing && email && report && (
        <SendEmailModal
          businessName={businessName}
          to={email}
          draft={outreachDraft(report.cold_email, businessName)}
          sentAt={mail.sentAt}
          sending={mail.sending}
          error={mail.error}
          onSend={sendEmail}
          onClose={() => setComposing(false)}
        />
      )}
    </div>
  );
}
