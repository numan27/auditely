// app/_shared/components/auditely/aiReportSection/aiReportSection.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { CheckIcon, CopyIcon, RefreshIcon } from '@/app/_shared/components/ui/icons/icons';
import { leadDrafts } from '@/app/_shared/lib/email/followUp';
import type { OutreachDraft } from '@/app/_shared/lib/email/outreach';
import { useConnections } from '@/app/_shared/lib/hooks/useConnections';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';
import type { AiReport, AuditRequest } from '@/app/_shared/lib/types/auditely';
import { copyText } from '@/app/_shared/lib/utils/browserExport';

interface AiReportSectionProps {
  report: AiReport;
  businessName: string;
  audit: AuditLike;
  /** When the first email went out; the follow-up shows from then on */
  emailedAt: string | null;
  /** Set for an audit requested on devartventures.com: the first email replies to it */
  request?: AuditRequest | null;
  /** "Write again": a new summary and email in place of these. Left out, the button is too (the demo). */
  onRewrite?: () => void;
  rewriting?: boolean;
  rewriteError?: string | null;
}

/** One email as "Send email" will send it, with a button to copy it */
function EmailDraft({ title, hint, draft }: { title: string; hint?: string; draft: OutreachDraft }) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const text = `Subject: ${draft.subject}\n\n${draft.body}`;

  // The browser can refuse (permission, or the page wasn't focused): then it says so
  const handleCopy = async () => {
    const done = await copyText(text);
    setCopy(done ? 'copied' : 'failed');
    setTimeout(() => setCopy('idle'), done ? 2000 : 6000);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
          {hint && <span className="ml-2 font-normal text-[var(--color-text-tertiary)]">{hint}</span>}
        </h4>
        <Button variant="ghost" size="sm" onClick={handleCopy} leftIcon={copy === 'copied' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}>
          {copy === 'copied' ? 'Copied' : 'Copy email'}
        </Button>
      </div>
      {copy === 'failed' && (
        <p role="status" className="mb-2 text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t copy. Select the email below and copy it yourself.
        </p>
      )}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">{text}</p>
      </div>
    </div>
  );
}

export function AiReportSection({ report, businessName, audit, emailedAt, request, onRewrite, rewriting, rewriteError }: AiReportSectionProps) {
  const drafts = leadDrafts(report.cold_email, businessName, audit, request, useConnections()?.sender);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Summary</h4>
            {onRewrite && (
              <Button variant="ghost" size="sm" onClick={onRewrite} disabled={rewriting} leftIcon={<RefreshIcon size={14} />}>
                {rewriting ? 'Writing…' : 'Write again'}
              </Button>
            )}
          </div>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{report.summary}</p>
          {rewriteError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{rewriteError}</p>}
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">What to fix first</h4>
          <ol className="space-y-2.5">
            {report.improvements.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-primary-600)]/15 text-[11px] font-semibold tabular-nums text-[var(--color-primary-600)]">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="space-y-6">
        <EmailDraft title={request ? 'Reply email' : 'Outreach email'} draft={drafts.first} />
        {emailedAt && <EmailDraft title="Follow-up email" hint="Sent by “Send follow-up”" draft={drafts.followUp} />}
      </div>
    </div>
  );
}
