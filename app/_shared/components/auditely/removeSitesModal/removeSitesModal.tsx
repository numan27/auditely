// app/_shared/components/auditely/removeSitesModal/removeSitesModal.tsx

'use client';

import { Button } from '@/app/_shared/components/ui/button/button';
import { Modal } from '@/app/_shared/components/ui/modal/modal';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

// A longer list is cut short: the count in the title says how many go
const LISTED = 5;

interface RemoveSitesModalProps {
  /** What is about to be removed: one site (its cross) or the whole list ("Clear all") */
  sites: BusinessWithData[];
  removing: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** Asks before websites leave the "Audit a website" list: their audits go with them, for good */
export function RemoveSitesModal({ sites, removing, error, onConfirm, onClose }: RemoveSitesModalProps) {
  const one = sites.length === 1;
  const sentToCrm = sites.some((site) => site.crm_sent_at);

  return (
    <Modal isOpen onClose={onClose} size="md" closeOnOverlayClick={!removing} closeOnEscape={!removing}>
      <Modal.Header
        title={one ? `Remove ${sites[0].name}?` : `Remove all ${sites.length} websites?`}
        onClose={onClose}
        showClose={!removing}
      />
      <Modal.Content>
        <div className="space-y-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {!one && (
            <ul className="list-disc space-y-0.5 pl-5 text-[var(--color-text-primary)]">
              {sites.slice(0, LISTED).map((site) => (
                <li key={site.id}>{site.name}</li>
              ))}
              {sites.length > LISTED && <li>and {sites.length - LISTED} more</li>}
            </ul>
          )}
          <p>
            {one
              ? 'Its audit, summary and outreach email are deleted with it.'
              : 'Their audits, summaries and outreach emails are deleted with them.'}{' '}
            This can&apos;t be undone: to get them back you would have to audit again.
          </p>
          {sentToCrm && (
            <p>
              {one ? 'This site was' : 'Some of these were'} sent to HubSpot. The company stays there, but its PDF report
              link stops working.
            </p>
          )}
          {error && (
            <p role="alert" className="text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </Modal.Content>
      <Modal.Footer>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={removing}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" onClick={onConfirm} isLoading={removing}>
          {one ? 'Remove' : 'Remove all'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
