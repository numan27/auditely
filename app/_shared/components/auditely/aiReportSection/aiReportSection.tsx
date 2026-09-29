// app/_shared/components/auditely/aiReportSection/aiReportSection.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { CheckIcon, CopyIcon } from '@/app/_shared/components/ui/icons/icons';
import type { AiReport } from '@/app/_shared/lib/types/auditely';

interface AiReportSectionProps {
  report: AiReport;
}

export function AiReportSection({ report }: AiReportSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report.cold_email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Outreach email</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            leftIcon={copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          >
            {copied ? 'Copied' : 'Copy email'}
          </Button>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {report.cold_email}
          </p>
        </div>
      </div>
    </div>
  );
}
