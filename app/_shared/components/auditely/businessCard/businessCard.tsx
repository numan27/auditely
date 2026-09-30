// app/_shared/components/auditely/businessCard/businessCard.tsx

'use client';

import { useState } from 'react';
import { Badge } from '@/app/_shared/components/ui/badge/badge';
import { CheckIcon, ChevronDownIcon, ExternalLinkIcon, GlobeIcon, MapPinIcon, PhoneIcon, StarIcon } from '@/app/_shared/components/ui/icons/icons';
import { AuditPanel } from '@/app/_shared/components/auditely/auditPanel/auditPanel';
import { BusinessEmail } from '@/app/_shared/components/auditely/businessEmail/businessEmail';
import { ContactLine } from '@/app/_shared/components/auditely/contactLine/contactLine';
import { ContactLinks } from '@/app/_shared/components/auditely/contactLinks/contactLinks';
import { useBusinessAudit } from '@/app/_shared/lib/hooks/useBusinessAudit';
import { isOutdatedAudit, isStaleAudit } from '@/app/_shared/lib/audit/types';
import { scoreTone, type ScoreTone } from '@/app/_shared/lib/audit/reportData';
import { reviewsLabel } from '@/app/_shared/lib/utils/reviewsLabel';
import type { Business, Audit, AiReport, BusinessUpdate } from '@/app/_shared/lib/types/auditely';

interface BusinessCardProps {
  business: Business;
  initialAudit?: Audit;
  initialReport?: AiReport;
  /** Receives emails, audits and reports this card finds or produces */
  onUpdate?: (businessId: string, update: BusinessUpdate) => void;
  /** Start the audit as soon as the card appears (sites added by URL) */
  autoRun?: boolean;
}

const PILL_TONES: Record<ScoreTone, string> = {
  good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  ok: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  poor: 'bg-red-500/10 text-red-700 dark:text-red-400',
  none: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]',
};

// Host and path only: tracking query strings are noise here
const displayDomain = (url: string) =>
  url.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '');

// Compact score summary shown when a completed card is collapsed
function ScorePills({ audit }: { audit: Audit }) {
  const scores: [string, number | null][] = [
    ['Performance', audit.performance_score],
    ['SEO', audit.seo_score],
    ['Mobile', audit.mobile_score],
    ['GEO', audit.geo_score],
    ['AEO', audit.aeo_score],
  ];
  const ssl = audit.ssl_valid;
  const sslTone: ScoreTone = ssl === null ? 'none' : ssl ? 'good' : 'poor';

  return (
    <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
      {scores.map(([label, score]) => (
        <span key={label} className={`rounded-md px-2 py-1 ${PILL_TONES[scoreTone(score)]}`}>
          {label} <span className="font-semibold tabular-nums">{score ?? '—'}</span>
        </span>
      ))}
      <span className={`rounded-md px-2 py-1 ${PILL_TONES[sslTone]}`}>
        SSL <span className="font-semibold">{ssl === null ? '—' : ssl ? 'Valid' : 'Invalid'}</span>
      </span>
    </div>
  );
}

export function BusinessCard({ business, initialAudit, initialReport, onUpdate, autoRun }: BusinessCardProps) {
  const state = useBusinessAudit(business, { initialAudit, initialReport, onUpdate, autoRun });
  const { audit, auditStatus, reportStatus, email, saveEmail } = state;
  // Pre-loaded cards (from saved searches) start collapsed; freshly processed cards start expanded
  const [isExpanded, setIsExpanded] = useState(!(initialAudit && initialReport));

  const isCompleted = auditStatus === 'done' && reportStatus === 'done';
  const isOutdated = auditStatus === 'done' && !!audit && isOutdatedAudit(audit.engine_version);
  // Outdated already says "re-audit"; stale only needs saying for a current-engine audit
  const isStale = auditStatus === 'done' && !!audit && !isOutdated && isStaleAudit(audit);
  const reviews = reviewsLabel(business.rating, business.review_count);

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-[var(--color-surface)] ${
        isCompleted ? 'border-emerald-500/40' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-start gap-3 px-5 py-4 sm:gap-4 sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-snug text-[var(--color-text-primary)]">{business.name}</h3>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <CheckIcon size={11} strokeWidth={3} />
                Audited
              </span>
            )}
            {isOutdated && <Badge variant="warning" size="sm">Outdated</Badge>}
            {isStale && <Badge variant="warning" size="sm">Over 30 days old</Badge>}
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            {/* On phones the website sits with the other details instead of beside the name */}
            {business.website && (
              <span className="sm:hidden">
                <ContactLine icon={<GlobeIcon size={14} />}>
                  <a href={business.website} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--color-primary-600)]">
                    {displayDomain(business.website)}
                  </a>
                </ContactLine>
              </span>
            )}
            {business.address && <ContactLine icon={<MapPinIcon size={14} />}>{business.address}</ContactLine>}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 empty:hidden">
              {business.phone && (
                <ContactLine icon={<PhoneIcon size={14} />}>
                  <a
                    href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}
                    className="hover:text-[var(--color-primary-600)] hover:underline"
                  >
                    {business.phone}
                  </a>
                </ContactLine>
              )}
              <BusinessEmail email={email} website={business.website} businessId={business.id} onFound={saveEmail} />
              {reviews && <ContactLine icon={<StarIcon size={14} />}>{reviews}</ContactLine>}
            </div>
          </div>

          <ContactLinks contactPage={business.contact_page} socials={business.socials} />
          {isCompleted && !isExpanded && audit && <ScorePills audit={audit} />}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {business.website ? (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden max-w-[260px] items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-[var(--color-primary-600)] transition-colors hover:bg-[var(--color-bg-secondary)] sm:inline-flex"
            >
              <span className="truncate">{displayDomain(business.website)}</span>
              <ExternalLinkIcon size={13} className="shrink-0" />
            </a>
          ) : (
            <Badge variant="warning" size="sm">No website</Badge>
          )}

          {isCompleted && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Hide audit details' : 'Show audit details'}
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <ChevronDownIcon size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {(!isCompleted || isExpanded) && <AuditPanel business={business} state={state} />}
    </article>
  );
}
