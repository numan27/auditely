// app/_shared/components/auditely/feedback/feedbackModal.tsx

'use client';

// The beta's feedback form: one message, emailed to the owner with the page it
// was written on. Replies go to the tester's own email. "Ask for more" in the
// upgrade prompt opens it with the message started (initial).

import { useState, type FormEvent } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Modal } from '@/app/_shared/components/ui/modal/modal';
import { TextArea } from '@/app/_shared/components/ui/textArea/textArea';
import { feedbackProblem, sendFeedback } from '@/app/_shared/lib/feedback/feedback';

interface FeedbackModalProps {
  onClose: () => void;
  /** The message to start from */
  initial?: string;
}

export function FeedbackModal({ onClose, initial = '' }: FeedbackModalProps) {
  const [message, setMessage] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = feedbackProblem(message);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    // The path only: a query can carry a search or a token
    const answer = await sendFeedback(message.trim(), window.location.pathname);
    setBusy(false);
    if (answer.ok) setSent(true);
    else setError(answer.error);
  }

  return (
    <Modal isOpen onClose={onClose} size="md">
      <Modal.Header title="Send feedback" onClose={onClose} />
      {sent ? (
        <>
          <Modal.Content>
            <p role="status" className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Thanks, it&apos;s sent. Any reply comes to your email.
            </p>
          </Modal.Content>
          <Modal.Footer>
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </Modal.Footer>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <Modal.Content>
            <p className="mb-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Tell us what works, what doesn&apos;t, and what you&apos;d like Auditely to do. Replies come to your email.
            </p>
            <TextArea
              label="Your message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              error={error ?? undefined}
              autoFocus
            />
          </Modal.Content>
          <Modal.Footer>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={busy}>
              Send
            </Button>
          </Modal.Footer>
        </form>
      )}
    </Modal>
  );
}
