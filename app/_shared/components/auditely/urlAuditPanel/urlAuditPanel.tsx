// app/_shared/components/auditely/urlAuditPanel/urlAuditPanel.tsx

'use client';

import { BusinessCard } from '@/app/_shared/components/auditely/businessCard/businessCard';
import { RemoveSitesModal } from '@/app/_shared/components/auditely/removeSitesModal/removeSitesModal';
import { ResultsSkeleton } from '@/app/_shared/components/auditely/resultsSkeleton/resultsSkeleton';
import { UrlAuditForm } from '@/app/_shared/components/auditely/urlAuditForm/urlAuditForm';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { useUrlAudits } from '@/app/_shared/lib/hooks/useUrlAudits';

/** "Audit a website": audit any URL, with every site audited this way listed below */
export function UrlAuditPanel() {
  const demo = useDemo();
  const { businesses, isLoading, busy, notice, autoRunId, addWebsite, findEmail, updateBusiness, removal, askRemove, cancelRemove, confirmRemove } =
    useUrlAudits();
  // The demo's sample stays put: nothing there can be removed
  const canRemove = !demo;

  return (
    <>
      <UrlAuditForm onSubmit={addWebsite} onFindEmail={findEmail} busy={busy} />
      {notice && (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mt-3 text-sm ${notice.tone === 'error' ? 'text-red-600 dark:text-red-400' : 'text-[var(--color-text-secondary)]'}`}
        >
          {notice.text}
        </p>
      )}

      {isLoading ? (
        <ResultsSkeleton label="Loading your website audits" count={2} />
      ) : businesses.length === 0 ? (
        <p className="mt-10 max-w-lg text-sm leading-relaxed text-[var(--color-text-tertiary)]">
          Paste a prospect&apos;s website to see how it scores on speed, SEO, mobile, SSL and AI search, or use Find email
          to get their email without a full audit. Every site you check here is saved in this list.
        </p>
      ) : (
        <section className="mt-10" aria-labelledby="url-audits-title">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="url-audits-title" className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Audited websites
            </h2>
            {canRemove && businesses.length > 1 && (
              <button
                type="button"
                onClick={() => askRemove(businesses)}
                className="shrink-0 cursor-pointer text-sm font-medium text-[var(--color-text-secondary)] hover:text-red-600 hover:underline dark:hover:text-red-400"
              >
                Clear all
              </button>
            )}
          </div>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            {businesses.length} {businesses.length === 1 ? 'site' : 'sites'}, newest first
          </p>
          <div className="mt-5 space-y-4">
            {businesses.map((business) => (
              <BusinessCard
                key={business.id}
                business={business}
                initialAudit={business.audit}
                initialReport={business.ai_report}
                onUpdate={updateBusiness}
                autoRun={business.id === autoRunId}
                defaultOpen={!!demo}
                onRemove={canRemove ? () => askRemove([business]) : undefined}
                upworkPdf
              />
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
