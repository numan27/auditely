// app/_shared/components/auditely/reportActions/reportActions.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { DownloadIcon, MailIcon } from '@/app/_shared/components/ui/icons/icons';
import { SendEmailModal } from '@/app/_shared/components/auditely/sendEmailModal/sendEmailModal';
import { leadDrafts } from '@/app/_shared/lib/email/followUp';
import { freshCheck } from '@/app/_shared/lib/email/emailCheck';
import type { OutreachDraft } from '@/app/_shared/lib/email/outreach';
import type { useCrmSend } from '@/app/_shared/lib/hooks/useCrmSend';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import type { useEmailSend } from '@/app/_shared/lib/hooks/useEmailSend';
import type { useBusinessAudit } from '@/app/_shared/lib/hooks/useBusinessAudit';
import type { AuditRequest } from '@/app/_shared/lib/types/auditely';
import { sentOn } from '@/app/_shared/lib/utils/sentOn';

interface ReportActionsProps {
  businessName: string;
  state: ReturnType<typeof useBusinessAudit>;
  crm: ReturnType<typeof useCrmSend>;
  mail: ReturnType<typeof useEmailSend>;
  /** Also offers the report without contact details or links, to attach on Upwork */
  upworkPdf?: boolean;
  /** Set for an audit requested on devartventures.com: the first email replies to it */
  request?: AuditRequest | null;
}

/** Once the AI report exists: email the lead, send it to HubSpot, or download its PDF */
export function ReportActions({ businessName, state, crm, mail, upworkPdf, request }: ReportActionsProps) {
  const demo = useDemo();
  const [composing, setComposing] = useState(false);
  const { email, report, audit } = state;

  const openComposer = () => {
    if (demo) return demo.restrict('sendEmail');
    mail.clearError();
    setComposing(true);
    // Is the address deliverable? A fresh saved answer is reused, so this often asks nothing
    void mail.verify();
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
          // In the demo the button always answers, with the notice
          disabled={!email && !demo}
          title={email || demo ? undefined : 'No email address found for this business'}
          leftIcon={<MailIcon size={14} />}
        >
          {mail.sentAt ? 'Send follow-up' : 'Send email'}
        </Button>
        <Button variant="outline" size="sm" onClick={demo ? () => demo.restrict('crm') : crm.send} isLoading={crm.sending}>
          {crm.sending ? 'Sending…' : crm.sentAt ? 'Update HubSpot' : 'Send to HubSpot'}
        </Button>
        {/* The demo's reports are built ahead, in one version */}
        {upworkPdf && !demo && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => state.downloadPdf('upwork')}
            isLoading={state.pdfLoading === 'upwork'}
            disabled={state.pdfLoading === 'full'}
            title="This report without contact details or links, to attach on Upwork"
            leftIcon={<DownloadIcon size={14} />}
          >
            {state.pdfLoading === 'upwork' ? 'Preparing PDF…' : 'Upwork PDF'}
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => state.downloadPdf()}
          isLoading={state.pdfLoading === 'full'}
          disabled={state.pdfLoading === 'upwork'}
          leftIcon={<DownloadIcon size={14} />}
        >
          {state.pdfLoading === 'full' ? 'Preparing PDF…' : 'Download PDF report'}
        </Button>
      </div>

      {composing && email && report && audit && (
        <SendEmailModal
          businessName={businessName}
          to={email}
          // Once the first email has gone, the next one is the follow-up
          draft={leadDrafts(report.cold_email, businessName, audit, request)[mail.sentAt ? 'followUp' : 'first']}
          sentAt={mail.sentAt}
          sending={mail.sending}
          error={mail.error}
          // A result too old to go by is not shown: the server would check again
          check={freshCheck(mail.check, email)}
          checking={mail.checking}
          checkNote={mail.checkNote}
          onSend={sendEmail}
          onPreview={mail.preview}
          onClose={() => setComposing(false)}
        />
      )}
    </div>
  );
}
