// app/_shared/components/auditely/sendEmailModal/sendEmailModal.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { EmailCheckNote } from '@/app/_shared/components/auditely/emailCheckNote/emailCheckNote';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Modal } from '@/app/_shared/components/ui/modal/modal';
import { TextArea } from '@/app/_shared/components/ui/textArea/textArea';
import { MailIcon } from '@/app/_shared/components/ui/icons/icons';
import { blocksSending, checkReason, type EmailCheck } from '@/app/_shared/lib/email/emailCheck';
import { BODY_MAX, outreachProblem, SUBJECT_MAX, type OutreachDraft } from '@/app/_shared/lib/email/outreach';
import { sentOn } from '@/app/_shared/lib/utils/sentOn';

interface SendEmailModalProps {
  businessName: string;
  to: string;
  /** The starting point: the AI's email, or the follow-up once that has been sent */
  draft: OutreachDraft;
  /** When this lead was last emailed, if ever */
  sentAt: string | null;
  sending: boolean;
  error: string | null;
  /** What Verifalia said about the address, when the check is fresh */
  check: EmailCheck | null;
  checking: boolean;
  /** Why the address wasn't checked, or that the result couldn't be saved */
  checkNote: string | null;
  onSend: (draft: OutreachDraft) => void;
  /** The email as the lead will see it (HTML) */
  onPreview: (draft: OutreachDraft) => Promise<string>;
  onClose: () => void;
}

/**
 * Review, edit and send one lead's outreach email. Mount it only while open:
 * the fields start from `draft` each time.
 */
export function SendEmailModal({ businessName, to, draft, sentAt, sending, error, check, checking, checkNote, onSend, onPreview, onClose }: SendEmailModalProps) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  // The designed email while it is being looked at; null while editing
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const problem = outreachProblem({ subject, body });
  // An address Verifalia calls undeliverable is never written to
  const blocked = check && blocksSending(check) ? `${checkReason(check)} This email can't be sent.` : null;

  const showPreview = async () => {
    setPreviewing(true);
    setPreviewError(null);
    try {
      setPreviewHtml(await onPreview({ subject, body }));
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Couldn't build the preview");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    // A stray click outside shouldn't throw away an edited email
    <Modal isOpen onClose={onClose} size="lg" closeOnOverlayClick={false} closeOnEscape={!sending}>
      <Modal.Header title={`Email ${businessName}`} onClose={onClose} showClose={!sending} />
      <Modal.Content>
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            To <span className="font-medium text-[var(--color-text-primary)]">{to}</span>
          </p>
          <EmailCheckNote checking={checking} check={check} note={checkNote} />
          {previewHtml === null ? (
            <>
              {/* Locked while the preview is built, so the preview is of what the fields say */}
              <Input
                label="Subject"
                value={subject}
                maxLength={SUBJECT_MAX}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending || previewing}
              />
              <TextArea
                label="Message"
                rows={12}
                value={body}
                maxLength={BODY_MAX}
                onChange={(e) => setBody(e.target.value)}
                disabled={sending || previewing}
              />
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Sent with your branding: your message, a snapshot of the audit and a “Book your free call” button, with the PDF
                report attached.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Subject <span className="font-medium text-[var(--color-text-primary)]">{subject}</span>
              </p>
              {/* An empty sandbox: nothing in the email can run, and its links (opened "in a new tab") go nowhere */}
              <iframe
                title="Email preview"
                srcDoc={previewHtml.replace('<head>', '<head><base target="_blank">')}
                sandbox=""
                className="h-[60vh] w-full rounded-lg border border-[var(--color-border)] bg-white"
              />
            </>
          )}
          {sentAt && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Already emailed on {sentOn(sentAt)}, so this is the follow-up.
            </p>
          )}
          {(previewError ?? error) && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {previewError ?? error}
            </p>
          )}
        </div>
      </Modal.Content>
      <Modal.Footer>
        {previewHtml === null ? (
          <Button
            variant="outline"
            size="sm"
            className="mr-auto"
            onClick={showPreview}
            isLoading={previewing}
            disabled={!!problem || sending}
            title={problem ?? undefined}
          >
            {previewing ? 'Building preview…' : 'Preview'}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="mr-auto" onClick={() => setPreviewHtml(null)} disabled={sending}>
            Edit
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setPreviewError(null);
            onSend({ subject, body });
          }}
          isLoading={sending}
          disabled={!!problem || checking || !!blocked}
          title={blocked ?? problem ?? undefined}
          leftIcon={<MailIcon size={14} />}
        >
          {sending ? 'Sending…' : sentAt ? 'Send follow-up' : 'Send email'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
