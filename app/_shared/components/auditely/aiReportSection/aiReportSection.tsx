// app/_shared/components/auditely/aiReportSection/aiReportSection.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
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
    <div className="space-y-6">
      {/* Summary */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-2">
          AI Summary
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {report.summary}
        </p>
      </div>

      {/* Improvements */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-3">
          Improvements
        </p>
        <ol className="space-y-2">
          {report.improvements.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary-600)] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {item}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Cold Email */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
            Cold Email
          </p>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </Button>
        </div>
        <div className="rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] p-4">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
            {report.cold_email}
          </p>
        </div>
      </div>
    </div>
  );
}
