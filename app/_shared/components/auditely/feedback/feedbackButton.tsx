// app/_shared/components/auditely/feedback/feedbackButton.tsx

'use client';

// The header's Feedback button: an icon on a phone, the word from 640px up.

import { useState } from 'react';
import { MailIcon } from '@/app/_shared/components/ui/icons/icons';
import { FeedbackModal } from '@/app/_shared/components/auditely/feedback/feedbackModal';

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center whitespace-nowrap rounded-md px-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] sm:px-2.5"
      >
        <span className="inline-flex sm:hidden" aria-hidden>
          <MailIcon size={16} />
        </span>
        <span className="sr-only sm:not-sr-only">Feedback</span>
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}
