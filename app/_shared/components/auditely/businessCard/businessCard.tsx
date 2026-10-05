// app/_shared/components/auditely/businessCard/businessCard.tsx

'use client';

import { useState } from 'react';
import { Badge } from '@/app/_shared/components/ui/badge/badge';
import { CheckIcon, ChevronDownIcon, ExternalLinkIcon, GlobeIcon, MapPinIcon, PhoneIcon, StarIcon, XIcon } from '@/app/_shared/components/ui/icons/icons';
import { AuditPanel } from '@/app/_shared/components/auditely/auditPanel/auditPanel';
import { BusinessEmail } from '@/app/_shared/components/auditely/businessEmail/businessEmail';
import { ContactLine } from '@/app/_shared/components/auditely/contactLine/contactLine';
import { ContactLinks } from '@/app/_shared/components/auditely/contactLinks/contactLinks';
import { useBusinessAudit } from '@/app/_shared/lib/hooks/useBusinessAudit';
import { useCrmSend } from '@/app/_shared/lib/hooks/useCrmSend';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { useEmailSend } from '@/app/_shared/lib/hooks/useEmailSend';
import { checkFor } from '@/app/_shared/lib/email/emailCheck';
import { isOutdatedAudit, isStaleAudit } from '@/app/_shared/lib/audit/types';
import { scoreTone, type ScoreTone } from '@/app/_shared/lib/audit/reportData';
import { reviewsLabel } from '@/app/_shared/lib/utils/reviewsLabel';
import type { BulkState } from '@/app/_shared/lib/utils/bulkAudit';
import type { Business, Audit, AiReport, BusinessUpdate } from '@/app/_shared/lib/types/auditely';

interface BusinessCardProps {
  business: Business;
  initialAudit?: Audit;
  initialReport?: AiReport;
  /** Receives emails, audits and reports this card finds or produces */
  onUpdate?: (businessId: string, update: BusinessUpdate) => void;
  /** Start the audit as soon as the card appears (sites added by URL) */
  autoRun?: boolean;
  /** Set while "Audit all" handles this business, and afterwards */
  bulk?: BulkState;
  /** Start with the report open although it's already audited (the demo's sample website) */
  defaultOpen?: boolean;
  /** Adds a cross that asks to remove this business from its list (websites added by URL) */
  onRemove?: () => void;
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
    ['Leads', audit.lead_score ?? null],
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

export function BusinessCard({ business, initialAudit, initialReport, onUpdate, autoRun, bulk, defaultOpen, onRemove }: BusinessCardProps) {
  const demo = useDemo();
  const state = useBusinessAudit(business, { initialAudit, initialReport, onUpdate, autoRun, bulk });
  const crm = useCrmSend(business, onUpdate);
  const mail = useEmailSend(business, onUpdate);
  const { audit, auditStatus, reportStatus, email, saveEmail } = state;
  // Pre-loaded cards (from saved searches) start collapsed, and so do the ones "Audit all"
  // finishes: dozens of open reports would bury the list. A card audited by hand opens.
  const [startedBlank] = useState(!(initialAudit && initialReport));
  const [toggled, setToggled] = useState<boolean | null>(defaultOpen ? true : null);
  const isExpanded = toggled ?? (startedBlank && bulk?.stage !== 'done');

  const isCompleted = auditStatus === 'done' && reportStatus === 'done';
  // The demo's sample has the age it has: no "Outdated" or "Over 30 days old" there
  const isOutdated = !demo && auditStatus === 'done' && !!audit && isOutdatedAudit(audit.engine_version);
  // Outdated already says "re-audit"; stale only needs saying for a current-engine audit
  const isStale = !demo && auditStatus === 'done' && !!audit && !isOutdated && isStaleAudit(audit);
  const reviews = reviewsLabel(business.rating, business.review_count);

  return (
    <article
      className={`group/card overflow-hidden rounded-2xl border bg-[var(--color-surface)] ${
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
                  {/* The demo's numbers are masked: nothing to call */}
                  {demo ? (
                    business.phone
                  ) : (
                    <a
                      href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}
                      className="hover:text-[var(--color-primary-600)] hover:underline"
                    >
                      {business.phone}
                    </a>
                  )}
                </ContactLine>
              )}
              <BusinessEmail email={email} website={business.website} businessId={business.id} check={checkFor(mail.check, email)} onFound={saveEmail} />
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
              onClick={() => setToggled(!isExpanded)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Hide audit details' : 'Show audit details'}
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <ChevronDownIcon size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* Shown on hover or keyboard focus; always where there is no hover (phones) */}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${business.name}`}
              title="Remove from this list"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-[var(--color-text-tertiary)] opacity-0 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 group-hover/card:opacity-100 dark:hover:text-red-400 [@media(hover:none)]:opacity-100"
            >
              <XIcon size={16} />
            </button>
          )}
        </div>
      </div>

      {(!isCompleted || isExpanded) && <AuditPanel business={business} state={state} crm={crm} mail={mail} />}
    </article>
  );
}
