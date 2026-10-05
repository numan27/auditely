// app/_shared/components/auditely/emailCheckNote/emailCheckNote.tsx

import { CheckIcon } from '@/app/_shared/components/ui/icons/icons';
import { checkNotices, type CheckTone, type EmailCheck } from '@/app/_shared/lib/email/emailCheck';

interface EmailCheckNoteProps {
  checking: boolean;
  /** What Verifalia said about the address, if it was checked */
  check: EmailCheck | null;
  /** Why it wasn't checked, or that the result couldn't be saved */
  note: string | null;
}

const TONES: Record<CheckTone, string> = {
  busy: 'text-[var(--color-text-tertiary)]',
  good: 'font-medium text-emerald-700 dark:text-emerald-400',
  warn: 'rounded-lg bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400',
  bad: 'rounded-lg bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-400',
};

/** The "Send email" dialog's lines about the address the email is going to */
export function EmailCheckNote({ checking, check, note }: EmailCheckNoteProps) {
  const notices = checkNotices({ checking, check, note });
  if (notices.length === 0) return null;

  return (
    <div className="space-y-2">
      {notices.map(({ tone, text }) => (
        <p key={text} role={tone === 'bad' ? 'alert' : 'status'} className={`text-sm ${TONES[tone]}`}>
          {tone === 'good' && <CheckIcon size={13} strokeWidth={3} className="mr-1 inline align-[-1px]" />}
          {text}
        </p>
      ))}
    </div>
  );
}
