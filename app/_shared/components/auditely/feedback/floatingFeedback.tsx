// app/_shared/components/auditely/feedback/floatingFeedback.tsx

'use client';

// The beta's Feedback button: it stays at the bottom right of every signed-in page,
// with its word on a phone too, so a tester finds it without looking for it. Room
// under the page lets the last thing on it scroll clear of the button. It lives
// outside the header, whose blur would pin a fixed button to the header itself.

import { useState } from 'react';
import { MailIcon } from '@/app/_shared/components/ui/icons/icons';
import { FeedbackModal } from '@/app/_shared/components/auditely/feedback/feedbackModal';

export function FloatingFeedback() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div aria-hidden className="h-16" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-[var(--color-primary-600)] px-4 text-sm font-semibold text-[var(--color-on-primary)] shadow-lg shadow-[rgb(47_79_224/0.3)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[var(--color-primary-700)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-600)] sm:right-6"
      >
        <MailIcon size={16} />
        <span>Feedback</span>
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}
