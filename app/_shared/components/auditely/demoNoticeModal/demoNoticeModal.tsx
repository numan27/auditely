// app/_shared/components/auditely/demoNoticeModal/demoNoticeModal.tsx

'use client';

import { Button } from '@/app/_shared/components/ui/button/button';
import { Modal } from '@/app/_shared/components/ui/modal/modal';
import type { DemoLinks } from '@/app/_shared/lib/demo/demoLinks';
import type { DemoAction } from '@/app/_shared/lib/hooks/useDemo';

// What each button does in the full app
const IN_THE_APP: Record<DemoAction, string> = {
  search: 'In the full app, Find leads searches Google for every business of that type in the area and lists them with their contact details.',
  auditUrl: 'In the full app, this audits any website you paste in about a minute, or finds its email address without a full audit.',
  reaudit: 'In the full app, Re-audit measures the website again and rewrites the summary and the outreach email.',
  findEmail: "In the full app, Find email searches the business's website and email databases for an address.",
  sendEmail: 'In the full app, this opens the outreach email to review, edit and send, with the PDF report attached.',
  crm: 'In the full app, this creates the company in HubSpot with the audit and a link to its PDF report.',
  export: 'In the full app, the list exports to CSV or straight into Google Sheets.',
};

const LINK = 'font-medium text-[var(--color-primary-600)] hover:underline';

interface DemoNoticeModalProps {
  action: DemoAction;
  links: DemoLinks;
  onClose: () => void;
}

/** Shown when a visitor to the public demo presses something that only runs in the full app */
export function DemoNoticeModal({ action, links, onClose }: DemoNoticeModalProps) {
  return (
    <Modal isOpen onClose={onClose} size="md">
      <Modal.Header title="Live generation is switched off in this demo" onClose={onClose} />
      <Modal.Content>
        <div className="space-y-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          <p>{IN_THE_APP[action]}</p>
          <p>Here you can explore a real saved search, replay its audits and download the PDF reports.</p>
          <p>
            Want to see it run live?{' '}
            {links.contactUrl ? (
              <>
                <a href={links.contactUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                  Get in touch
                </a>{' '}
                and I&apos;ll walk you through it.
              </>
            ) : (
              <>Message me on Upwork and I&apos;ll walk you through it.</>
            )}
          </p>
          {links.videoUrl && (
            <p>
              <a href={links.videoUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                Watch the 45-second walkthrough
              </a>
            </p>
          )}
        </div>
      </Modal.Content>
      <Modal.Footer>
        <Button variant="primary" size="sm" onClick={onClose}>
          Got it
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
