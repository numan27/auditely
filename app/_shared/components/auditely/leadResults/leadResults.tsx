// app/_shared/components/auditely/leadResults/leadResults.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { BulkAuditControl } from '@/app/_shared/components/auditely/bulkAuditControl/bulkAuditControl';
import { BusinessCard } from '@/app/_shared/components/auditely/businessCard/businessCard';
import { GoogleMapsAttribution } from '@/app/_shared/components/auditely/googleMapsAttribution/googleMapsAttribution';
import { LeadToolbar } from '@/app/_shared/components/auditely/leadToolbar/leadToolbar';
import { useBulkAudit } from '@/app/_shared/lib/hooks/useBulkAudit';
import { useLeadView } from '@/app/_shared/lib/hooks/useLeadView';
import type { DiscoveryProgress } from '@/app/_shared/lib/hooks/useEmailDiscovery';
import type { SearchQuery } from '@/app/_shared/lib/hooks/useLeadSearch';
import type { BusinessUpdate, BusinessWithData } from '@/app/_shared/lib/types/auditely';
import { needsAudit, type BulkState } from '@/app/_shared/lib/utils/bulkAudit';
import { exportFileName } from '@/app/_shared/lib/utils/leadExport';
import { matchesFilters } from '@/app/_shared/lib/utils/leadView';
import { searchTitle } from '@/app/_shared/lib/utils/searchLabel';

const PAGE_SIZE = 20;

interface LeadResultsProps {
  businesses: BusinessWithData[];
  query: SearchQuery | null;
  discovery: DiscoveryProgress;
  onUpdate: (businessId: string, update: BusinessUpdate) => void;
  /** The cross on a card; without it (the demo) cards can't be removed */
  onRemove?: (business: BusinessWithData) => void;
}

// A card "Audit all" is still working on keeps its cross hidden until its turn is over
const inBulkRun = (state: BulkState | undefined) => !!state && state.stage !== 'done' && state.stage !== 'failed';

/**
 * One search's results: heading, sticky filter/sort/export bar and the cards,
 * revealed 20 at a time as you scroll. Mount it with a new key per result set.
 */
export function LeadResults({ businesses, query, discovery, onUpdate, onRemove }: LeadResultsProps) {
  const discoveryDone = discovery.done >= discovery.total;
  const bulk = useBulkAudit(onUpdate);
  // Re-arranged once discovery has found the emails, and after each "Audit all" run
  const view = useLeadView(businesses, `${discoveryDone}|${bulk.runsFinished}`);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const visible = view.leads.slice(0, visibleCount);
  const hasMore = visibleCount < view.leads.length;
  const withoutWebsite = businesses.filter((b) => !b.website).length;
  const isFiltered = view.filters.length > 0 || view.emailed !== 'all';
  // "Audit all" covers the businesses the filters show, whether or not they're scrolled into view
  const toAudit = businesses.filter((b) => needsAudit(b) && matchesFilters(b, view.filters, view.emailed)).length;
  const { currentLeads } = view;
  const { start: startBulk } = bulk;
  const auditAll = useCallback(() => startBulk(currentLeads().filter(needsAudit)), [startBulk, currentLeads]);

  const loadMore = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + PAGE_SIZE);
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore]);

  // Reveal the next page when the sentinel scrolls into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  return (
    <section className="mt-10" aria-labelledby="results-title">
      <h2 id="results-title" className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
        {query ? searchTitle(query) : 'Search results'}
      </h2>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-text-secondary)]">
        <span>{businesses.length} businesses</span>
        {withoutWebsite > 0 && <span className="text-[var(--color-text-tertiary)]">{withoutWebsite} without a website</span>}
        {!discoveryDone && (
          <span className="inline-flex items-center gap-1.5 text-[var(--color-text-tertiary)]">
            <Spinner size="sm" />
            Finding contacts, {discovery.done} of {discovery.total}
          </span>
        )}
      </p>
      {/* The businesses are Google Maps place data, so Google's notice sits above them */}
      <GoogleMapsAttribution className="mt-3" />

      <div className="sticky top-14 z-30 -mx-4 mt-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <LeadToolbar
          sort={view.sort}
          onSortChange={view.setSort}
          filters={view.filters}
          counts={view.counts}
          onToggleFilter={view.toggleFilter}
          emailed={view.emailed}
          countEmailed={view.countEmailed}
          onEmailedChange={view.setEmailed}
          getExportLeads={view.currentLeads}
          exportFileName={exportFileName(query)}
          actions={<BulkAuditControl pending={toAudit} progress={bulk.progress} onStart={auditAll} onStop={bulk.stop} />}
        />
      </div>

      {isFiltered && view.leads.length > 0 && (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          {view.leads.length} of {businesses.length} match.{' '}
          <button type="button" onClick={view.clearFilters} className="cursor-pointer font-medium text-[var(--color-primary-600)] hover:underline">
            Clear filters
          </button>
        </p>
      )}

      {view.leads.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--color-border-hover)] px-6 py-12 text-center">
          <p className="font-medium text-[var(--color-text-primary)]">No businesses match these filters</p>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Turn off a filter to see more of this search.</p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={view.clearFilters}>Clear filters</Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {visible.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              initialAudit={business.audit}
              initialReport={business.ai_report}
              onUpdate={onUpdate}
              bulk={bulk.states[business.id]}
              onRemove={onRemove && !inBulkRun(bulk.states[business.id]) ? () => onRemove(business) : undefined}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {isLoadingMore && <Spinner size="md" />}
        </div>
      )}
      {!hasMore && view.leads.length > PAGE_SIZE && (
        <p className="py-8 text-center text-sm text-[var(--color-text-tertiary)]">
          That&apos;s all {view.leads.length} {isFiltered ? 'matching businesses' : 'businesses'}.
        </p>
      )}
    </section>
  );
}
