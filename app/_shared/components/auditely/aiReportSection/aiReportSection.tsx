// app/_shared/components/auditely/aiReportSection/aiReportSection.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { CheckIcon, CopyIcon } from '@/app/_shared/components/ui/icons/icons';
import { leadDrafts } from '@/app/_shared/lib/email/followUp';
import type { OutreachDraft } from '@/app/_shared/lib/email/outreach';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';
import type { AiReport } from '@/app/_shared/lib/types/auditely';

interface AiReportSectionProps {
  report: AiReport;
  businessName: string;
  audit: AuditLike;
  /** When the first email went out; the follow-up shows from then on */
  emailedAt: string | null;
}

/** One email as "Send email" will send it, with a button to copy it */
function EmailDraft({ title, hint, draft }: { title: string; hint?: string; draft: OutreachDraft }) {
  const [copied, setCopied] = useState(false);
  const text = `Subject: ${draft.subject}\n\n${draft.body}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
          {hint && <span className="ml-2 font-normal text-[var(--color-text-tertiary)]">{hint}</span>}
        </h4>
        <Button variant="ghost" size="sm" onClick={handleCopy} leftIcon={copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}>
          {copied ? 'Copied' : 'Copy email'}
        </Button>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">{text}</p>
      </div>
    </div>
  );
}

export function AiReportSection({ report, businessName, audit, emailedAt }: AiReportSectionProps) {
  const drafts = leadDrafts(report.cold_email, businessName, audit);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Summary</h4>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{report.summary}</p>
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
        <EmailDraft title="Outreach email" draft={drafts.first} />
        {emailedAt && <EmailDraft title="Follow-up email" hint="Sent by “Send follow-up”" draft={drafts.followUp} />}
      </div>
    </div>
  );
}
