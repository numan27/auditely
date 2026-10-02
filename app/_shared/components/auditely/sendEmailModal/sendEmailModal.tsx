// app/_shared/components/auditely/sendEmailModal/sendEmailModal.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Modal } from '@/app/_shared/components/ui/modal/modal';
import { TextArea } from '@/app/_shared/components/ui/textArea/textArea';
import { MailIcon } from '@/app/_shared/components/ui/icons/icons';
import { BODY_MAX, outreachProblem, SUBJECT_MAX, type OutreachDraft } from '@/app/_shared/lib/email/outreach';

interface SendEmailModalProps {
  businessName: string;
  to: string;
  /** The AI's email, as the starting point */
  draft: OutreachDraft;
  /** When this lead was last emailed, if ever */
  sentAt: string | null;
  sending: boolean;
  error: string | null;
  onSend: (draft: OutreachDraft) => void;
  onClose: () => void;
}

const sentOn = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Review, edit and send one lead's outreach email. Mount it only while open:
 * the fields start from `draft` each time.
 */
export function SendEmailModal({ businessName, to, draft, sentAt, sending, error, onSend, onClose }: SendEmailModalProps) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const problem = outreachProblem({ subject, body });

  return (
    // A stray click outside shouldn't throw away an edited email
    <Modal isOpen onClose={onClose} size="lg" closeOnOverlayClick={false} closeOnEscape={!sending}>
      <Modal.Header title={`Email ${businessName}`} onClose={onClose} showClose={!sending} />
      <Modal.Content>
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            To <span className="font-medium text-[var(--color-text-primary)]">{to}</span>
          </p>
          <Input label="Subject" value={subject} maxLength={SUBJECT_MAX} onChange={(e) => setSubject(e.target.value)} disabled={sending} />
          <TextArea
            label="Message"
            rows={12}
            value={body}
            maxLength={BODY_MAX}
            onChange={(e) => setBody(e.target.value)}
            disabled={sending}
          />
          <p className="text-sm text-[var(--color-text-tertiary)]">The PDF report is attached automatically.</p>
          {sentAt && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Already emailed on {sentOn(sentAt)}. Sending now emails them again.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </Modal.Content>
      <Modal.Footer>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSend({ subject, body })}
          isLoading={sending}
          disabled={!!problem}
          title={problem ?? undefined}
          leftIcon={<MailIcon size={14} />}
        >
          {sending ? 'Sending…' : sentAt ? 'Send again' : 'Send email'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
