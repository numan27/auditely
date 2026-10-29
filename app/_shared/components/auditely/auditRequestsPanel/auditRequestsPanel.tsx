// app/_shared/components/auditely/auditRequestsPanel/auditRequestsPanel.tsx

'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { RefreshIcon } from '@/app/_shared/components/ui/icons/icons';
import { BusinessCard } from '@/app/_shared/components/auditely/businessCard/businessCard';
import { CollapseAllButton, useCollapseAll } from '@/app/_shared/components/auditely/collapseAll/collapseAll';
import { RemoveSitesModal } from '@/app/_shared/components/auditely/removeSitesModal/removeSitesModal';
import { ResultsSkeleton } from '@/app/_shared/components/auditely/resultsSkeleton/resultsSkeleton';
import { useAuditRequests } from '@/app/_shared/lib/hooks/useAuditRequests';

interface AuditRequestsPanelProps {
  /** The request the address names (/requests/{id}): its card opens and scrolls into view */
  openId?: string | null;
  /** A card was opened by hand (its id), or the named one was closed or isn't in the list (null) */
  onOpenChange?: (id: string | null) => void;
}

export const requestCardId = (id: string) => `request-${id}`;

/** "Requests": free audits requested on devartventures.com, each ready to reply to with its report */
export function AuditRequestsPanel({ openId = null, onOpenChange }: AuditRequestsPanelProps) {
  const { businesses, isLoading, refreshing, error, loadKey, refresh, updateBusiness, removal, askRemove, cancelRemove, confirmRemove } =
    useAuditRequests();
  const waiting = businesses.filter((b) => !b.emailed_at).length;
  const auditing = businesses.some((b) => !b.audit);
  // The named request is scrolled to once; one missing from the list is looked for once more (it may have just arrived)
  const scrolledTo = useRef<string | null>(null);
  const lookedFor = useRef<string | null>(null);
  const { signal: collapseSignal, collapseAll } = useCollapseAll();

  useEffect(() => {
    if (!openId || isLoading || refreshing) return;
    const card = document.getElementById(requestCardId(openId));
    if (card) {
      if (scrolledTo.current !== openId) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
      scrolledTo.current = openId;
    } else if (lookedFor.current !== openId) {
      lookedFor.current = openId;
      void refresh();
    } else {
      onOpenChange?.(null);
    }
  }, [openId, isLoading, refreshing, businesses, refresh, onOpenChange]);

  const toggle = (id: string, open: boolean) => {
    if (open) {
      // Opened right here: no need to scroll to it
      scrolledTo.current = id;
      lookedFor.current = id;
      onOpenChange?.(id);
    } else if (id === openId) {
      onOpenChange?.(null);
    }
  };

  // The address no longer names a request once its card is closed
  const collapse = () => {
    collapseAll();
    if (openId) onOpenChange?.(null);
  };

  return (
    <>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <ResultsSkeleton label="Loading audit requests" count={2} />
      ) : businesses.length === 0 ? (
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-lg text-sm leading-relaxed text-[var(--color-text-tertiary)]">
            When someone requests a free audit on devartventures.com, it appears here already audited, with a reply
            ready to send with the PDF report.
          </p>
          <Button variant="outline" size="sm" onClick={refresh} isLoading={refreshing} leftIcon={<RefreshIcon size={14} />}>
            Refresh
          </Button>
        </div>
      ) : (
        <section className="mt-6" aria-labelledby="audit-requests-title">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="audit-requests-title" className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Audit requests
            </h2>
            <div className="flex items-center gap-3">
              <CollapseAllButton count={businesses.length} onClick={collapse} />
              {businesses.length > 1 && (
                <button
                  type="button"
                  onClick={() => askRemove(businesses)}
                  className="shrink-0 cursor-pointer text-sm font-medium text-[var(--color-text-secondary)] hover:text-red-600 hover:underline dark:hover:text-red-400"
                >
                  Clear all
                </button>
              )}
              <Button variant="outline" size="sm" onClick={refresh} isLoading={refreshing} leftIcon={<RefreshIcon size={14} />}>
                Refresh
              </Button>
            </div>
          </div>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            {businesses.length} {businesses.length === 1 ? 'request' : 'requests'}, newest first
            {waiting > 0 && `, ${waiting} waiting for a reply`}.
            {auditing && ' A new request is audited in the background: Refresh in a minute or two to see its scores.'}
          </p>
          <div className="mt-5 space-y-4">
            {businesses.map((business) => (
              // Clear of the sticky header when scrolled to
              <div key={`${business.id}-${loadKey}`} id={requestCardId(business.id)} className="scroll-mt-20">
                <BusinessCard
                  business={business}
                  initialAudit={business.audit}
                  initialReport={business.ai_report}
                  onUpdate={updateBusiness}
                  onRemove={() => askRemove([business])}
                  open={business.id === openId}
                  onToggle={(open) => toggle(business.id, open)}
                  collapseSignal={collapseSignal}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {removal && (
        <RemoveSitesModal
          sites={removal.sites}
          removing={removal.busy}
          error={removal.error}
          onConfirm={confirmRemove}
          onClose={cancelRemove}
        />
      )}
    </>
  );
}
