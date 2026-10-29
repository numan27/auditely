// app/_shared/components/auditely/reportActions/reportActions.tsx

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { DownloadIcon, ExternalLinkIcon, MailIcon } from '@/app/_shared/components/ui/icons/icons';
import { outreachOptions, type OutreachAction } from '@/app/_shared/components/auditely/reportActions/outreachOptions';
import { SendEmailModal } from '@/app/_shared/components/auditely/sendEmailModal/sendEmailModal';
import { composeLinks } from '@/app/_shared/lib/email/composeLinks';
import { hasPitch, leadDrafts } from '@/app/_shared/lib/email/followUp';
import { freshCheck } from '@/app/_shared/lib/email/emailCheck';
import type { OutreachDraft } from '@/app/_shared/lib/email/outreach';
import { useAccount } from '@/app/_shared/lib/hooks/useAccount';
import { useConnections } from '@/app/_shared/lib/hooks/useConnections';
import type { useCrmSend } from '@/app/_shared/lib/hooks/useCrmSend';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import type { useEmailSend } from '@/app/_shared/lib/hooks/useEmailSend';
import type { useBusinessAudit } from '@/app/_shared/lib/hooks/useBusinessAudit';
import { useUsage } from '@/app/_shared/lib/hooks/useUsage';
import type { AuditRequest } from '@/app/_shared/lib/types/auditely';
import { sentOn } from '@/app/_shared/lib/utils/sentOn';

interface ReportActionsProps {
  businessName: string;
  state: ReturnType<typeof useBusinessAudit>;
  crm: ReturnType<typeof useCrmSend>;
  mail: ReturnType<typeof useEmailSend>;
  /** Also offers the owner the report without contact details or links, to attach on Upwork */
  upworkPdf?: boolean;
  /** Set for an audit requested on devartventures.com: the first email replies to it */
  request?: AuditRequest | null;
}

const NO_EMAIL = 'No email address found for this business';

const setupLinkClasses = [buttonStyles.button, buttonStyles['button--outline'], buttonStyles['button--sm']].join(' ');

/** What a paid account still has to connect, as a link to it in Settings */
function SetupLink({ action }: { action: Extract<OutreachAction, { kind: 'setup' }> }) {
  return (
    <Link href={action.href} className={setupLinkClasses}>
      {action.label}
    </Link>
  );
}

/** Once the AI report exists: email the lead, send it to HubSpot, or download its PDF */
export function ReportActions({ businessName, state, crm, mail, upworkPdf, request }: ReportActionsProps) {
  const demo = useDemo();
  const connections = useConnections();
  const usage = useUsage();
  const options = outreachOptions({ demo: !!demo, account: useAccount(), connections, upworkPdf: !!upworkPdf });
  const [composing, setComposing] = useState(false);
  const { email, report, audit } = state;
  // A website with nothing to fix has nothing to pitch: no email buttons
  const mailKind = report && !hasPitch(report.improvements, request, mail.sentAt) ? 'none' : options.mail.kind;
  const drafts = () => report && audit && leadDrafts(report.cold_email, businessName, audit, request, connections?.sender);

  const openComposer = () => {
    if (demo) return demo.restrict('sendEmail');
    mail.clearError();
    setComposing(true);
    // Is the address deliverable? A fresh saved answer is reused, so this often asks nothing
    if (options.verifyOnOpen) void mail.verify();
  };
  // A Free account sends from its own mail, with the PDF attached by hand
  const openDraft = (app: 'gmail' | 'outlook') => {
    const first = drafts()?.first;
    if (email && first) window.open(composeLinks(email, first)[app], '_blank', 'noopener,noreferrer');
  };
  const sendEmail = async (draft: OutreachDraft) => {
    if (await mail.send(draft)) setComposing(false);
  };

  // The PDF's first: it's what was pressed last when it's set (pressing again clears it)
  const problem = state.pdfError ?? crm.error ?? mail.warning;
  const done = [mail.sentAt && `Emailed ${sentOn(mail.sentAt)}`, crm.sentAt && `Sent to HubSpot ${sentOn(crm.sentAt)}`].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-5 py-3 sm:px-6">
      <p className="text-sm text-[var(--color-text-tertiary)]">
        {problem ? (
          <span className="text-red-600 dark:text-red-400">{problem}</span>
        ) : done.length ? (
          done.join(' · ')
        ) : mailKind === 'none' ? (
          "No problems found, so there's no email to send."
        ) : mailKind === 'compose' ? (
          'Download the PDF and attach it before you send.'
        ) : (
          'A branded PDF of this audit, ready to send.'
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {mailKind === 'send' && (
          <Button
            variant="outline"
            size="sm"
            onClick={openComposer}
            // In the demo the button always answers, with the notice
            disabled={!email && !demo}
            title={email || demo ? undefined : NO_EMAIL}
            leftIcon={<MailIcon size={14} />}
          >
            {mail.sentAt ? 'Send follow-up' : 'Send email'}
          </Button>
        )}
        {/* Sending from a mailbox is paid: a Free account's button says so, and sends nothing */}
        {mailKind === 'compose' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => usage?.promptUpgrade({ feature: 'mailbox' })}
            leftIcon={<MailIcon size={14} />}
          >
            Send email
          </Button>
        )}
        {mailKind === 'compose' &&
          (['gmail', 'outlook'] as const).map((app) => (
            <Button
              key={app}
              variant="outline"
              size="sm"
              onClick={() => openDraft(app)}
              disabled={!email}
              title={email ? undefined : NO_EMAIL}
              leftIcon={<ExternalLinkIcon size={14} />}
            >
              {app === 'gmail' ? 'Open in Gmail' : 'Open in Outlook'}
            </Button>
          ))}
        {mailKind === 'setup' && options.mail.kind === 'setup' && <SetupLink action={options.mail} />}
        {options.hubspot.kind === 'send' && (
          <Button variant="outline" size="sm" onClick={demo ? () => demo.restrict('crm') : crm.send} isLoading={crm.sending}>
            {crm.sending ? 'Sending…' : crm.sentAt ? 'Update HubSpot' : 'Send to HubSpot'}
          </Button>
        )}
        {options.hubspot.kind === 'upgrade' && (
          <Button variant="outline" size="sm" onClick={() => usage?.promptUpgrade({ feature: 'hubspot' })}>
            Send to HubSpot
          </Button>
        )}
        {options.hubspot.kind === 'setup' && <SetupLink action={options.hubspot} />}
        {/* The owner's alone; the demo's reports are built ahead, in one version */}
        {options.upworkPdf && (
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
          draft={leadDrafts(report.cold_email, businessName, audit, request, connections?.sender)[mail.sentAt ? 'followUp' : 'first']}
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
