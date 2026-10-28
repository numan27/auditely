// app/_shared/components/auditely/reAuditConfirm/reAuditConfirm.tsx

'use client';

// Re-audit on a plan with a limit asks first, since it uses one of the account's
// audits: it names the business and says how many are left (reAuditNote).

import { Button } from '@/app/_shared/components/ui/button/button';
import { Modal } from '@/app/_shared/components/ui/modal/modal';

interface ReAuditConfirmProps {
  businessName: string;
  /** What the Re-audit costs, from reAuditNote() */
  note: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ReAuditConfirm({ businessName, note, onConfirm, onClose }: ReAuditConfirmProps) {
  return (
    <Modal isOpen onClose={onClose} size="sm">
      <Modal.Header title={`Re-audit ${businessName}?`} onClose={onClose} />
      <Modal.Content>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{note}</p>
      </Modal.Content>
      <Modal.Footer>
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          Re-audit
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
