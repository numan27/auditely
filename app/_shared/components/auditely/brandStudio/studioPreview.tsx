// app/_shared/components/auditely/brandStudio/studioPreview.tsx

// The studio's proof: the sample report or email, redrawn as the draft
// changes, on a desk beside the editor. The email is shown in a sandboxed
// frame with no scripts; nothing in either is sent anywhere.

'use client';

import { useState } from 'react';
import { useStudioPreview, type PreviewFormat } from '@/app/_shared/components/auditely/brandStudio/useStudioPreview';
import { ExternalLinkIcon } from '@/app/_shared/components/ui/icons/icons';

const FORMATS: { id: PreviewFormat; label: string }[] = [
  { id: 'report', label: 'Report' },
  { id: 'email', label: 'Email' },
];

function Waiting({ children }: { children: string }) {
  return <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-500">{children}</div>;
}

export function StudioPreview({ payload }: { payload: object }) {
  const [format, setFormat] = useState<PreviewFormat>('report');
  const { pdfUrl, email, updating, error } = useStudioPreview(payload, format);

  let proof;
  if (format === 'report') {
    proof = pdfUrl ? (
      <iframe key="report" title="Report preview" src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} className="h-full w-full bg-white" />
    ) : (
      <Waiting>{error ?? 'Drawing the sample report…'}</Waiting>
    );
  } else if (email?.html) {
    proof = <iframe key="email" title="Email preview" sandbox="" srcDoc={email.html} className="h-full w-full bg-white" />;
  } else {
    proof = <Waiting>{email?.hint ?? error ?? 'Writing the sample email…'}</Waiting>;
  }

  return (
    <section aria-label="Preview" className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div role="radiogroup" aria-label="Preview" className="inline-flex rounded-lg bg-[var(--color-bg-tertiary)] p-0.5">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={format === f.id}
              onClick={() => setFormat(f.id)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary-500)] ${
                format === f.id
                  ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-tertiary)]" aria-live="polite">
          {updating ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-primary-500)] motion-reduce:animate-none" />
              Updating preview
            </span>
          ) : error && (pdfUrl || email) ? (
            <span className="text-[var(--color-error)]">{error}</span>
          ) : (
            'A sample audit, drawn with your changes'
          )}
        </p>
        {format === 'report' && pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Open full size <ExternalLinkIcon size={12} />
          </a>
        )}
      </div>
      <div className="min-h-0 flex-1 px-3 pb-3 sm:px-5 sm:pb-5">
        <div className="h-full overflow-hidden rounded-lg bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_32px_-12px_rgba(16,24,40,0.22)] ring-1 ring-black/5">
          {proof}
        </div>
      </div>
    </section>
  );
}
