// app/_shared/lib/crm/leadPayload.ts

// A lead as a CRM sees it: company and contact fields, and a note with the
// audit. Pure; hubspot.ts sends it.

import { rankedProblems } from '@/app/_shared/lib/audit/impact';
import { isOutdatedAudit } from '@/app/_shared/lib/audit/types';
import type { AiReport, Audit, Business } from '@/app/_shared/lib/types/auditely';
import { escapeHtml } from '@/app/_shared/lib/utils/html';

export interface LeadInput {
  business: Pick<Business, 'name' | 'address' | 'website' | 'phone' | 'email' | 'rating' | 'review_count'>;
  niche: string | null;
  audit: Audit;
  report: AiReport;
  /** The private PDF link (/report/{token}) */
  reportUrl: string;
}

export interface LeadPayload {
  /** The website's domain, used to find the company again */
  domain: string | null;
  company: Record<string, string>;
  /** Only when the business has an email */
  contact: { email: string; properties: Record<string, string> } | null;
  /** Set only when creating: HubSpot refuses moving a stage backwards */
  onCreate: { company: Record<string, string>; contact: Record<string, string> };
  noteHtml: string;
}

// HubSpot's industry values follow this naming but aren't published; a value
// it rejects is dropped (hubspot.ts). First match wins, so vets come before
// "clinic"; `unless` keeps e.g. "lawn doctor" or "internet cafe" out.
const INDUSTRIES: { match: RegExp; unless?: RegExp; industry: string; group: string }[] = [
  { match: /\bvets?\b|veterinar|animal (clinic|hospital)|pet clinic/, industry: 'VETERINARY', group: 'Health' },
  {
    match: /dentist|dental|orthodont|clinic|medical|doctor|physician|chiropract|physio|dermatolog|pediatric/,
    unless: /lawn|tree|computer|phone|repair|beauty|auto|\bcar\b|bike/,
    industry: 'MEDICAL_PRACTICE',
    group: 'Health',
  },
  { match: /school|academy|tutor|preschool|daycare|college|university|education/, industry: 'EDUCATION_MANAGEMENT', group: 'Education' },
  { match: /lawyer|attorney|law firm|law office|legal/, industry: 'LAW_PRACTICE', group: 'Legal' },
  { match: /restaurant|\bcafe\b|bakery/, unless: /internet|cyber/, industry: 'RESTAURANTS', group: 'Food' },
  { match: /roof|plumb|hvac|electrician|electrical|contractor|construction/, industry: 'CONSTRUCTION', group: 'Home services' },
  { match: /gym|fitness|yoga|\bspa\b|salon|beauty/, industry: 'HEALTH_WELLNESS_AND_FITNESS', group: 'Fitness & beauty' },
  { match: /real estate|realtor/, industry: 'REAL_ESTATE', group: 'Real estate' },
  { match: /accountant|accounting|\bcpa\b|bookkeep/, industry: 'ACCOUNTING', group: 'Finance' },
];

export function industryFor(niche: string | null): { industry: string | null; group: string } {
  const text = niche?.toLowerCase() ?? '';
  const rule = INDUSTRIES.find((r) => r.match.test(text) && !r.unless?.test(text));
  return rule ? { industry: rule.industry, group: rule.group } : { industry: null, group: 'Other' };
}

const score = (value: number | null | undefined) => (typeof value === 'number' ? String(value) : '—');

// Platforms many businesses share: a domain there isn't the business's own
const SHARED_HOSTS = /(^|\.)(facebook\.com|instagram\.com|linktr\.ee|google\.com|yelp\.com|x\.com|twitter\.com|tiktok\.com|linkedin\.com)$/;

/**
 * The business's own domain, used to find its company again: only for a
 * homepage on a host of its own. A deeper page (one agent on a franchise site)
 * or a shared platform would merge different businesses into one company.
 */
function domainOf(website: string | null): string | null {
  if (!website) return null;
  let url: URL;
  try {
    url = new URL(website);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const isHomepage = url.pathname === '/' || url.pathname === '';
  return isHomepage && !SHARED_HOSTS.test(host) ? host : null;
}

// Leaves out empty values
const present = (fields: Record<string, string | null | undefined>): Record<string, string> =>
  Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => !!entry[1]));

function noteHtml({ business, audit, report, reportUrl }: LeadInput, group: string): string {
  // v1 audits never measured SEO or SSL (their 0 / false meant "unknown")
  const outdated = isOutdatedAudit(audit.engine_version);
  const ssl = outdated || audit.ssl_valid === null ? '—' : audit.ssl_valid ? 'valid' : 'invalid';
  const scores = [
    `Performance ${score(audit.performance_score)}`,
    `Mobile ${score(audit.mobile_score)}`,
    `SEO ${outdated ? '—' : score(audit.seo_score)}`,
    `SSL ${ssl}`,
    `GEO ${score(audit.geo_score)}`,
    `AEO ${score(audit.aeo_score)}`,
    `Lead capture ${score(audit.lead_score)}`,
  ].join(' · ');
  const audited = new Date(audit.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const rating =
    typeof business.review_count === 'number'
      ? `Google rating ${typeof business.rating === 'number' ? business.rating.toFixed(1) : '—'} from ${business.review_count} reviews`
      : null;
  const problems = rankedProblems(audit).slice(0, 4).map((p) => `<li>${escapeHtml(p.problem)}</li>`).join('');

  return [
    `<p><strong>Auditely audit lead — ${escapeHtml(group)}</strong></p>`,
    `<p>Audited ${escapeHtml(audited)}: ${scores}</p>`,
    rating && `<p>${escapeHtml(rating)}</p>`,
    problems && `<p><strong>Top problems</strong></p><ul>${problems}</ul>`,
    `<p><strong>Summary</strong><br>${escapeHtml(report.summary)}</p>`,
    `<p><strong>Cold email draft</strong><br>${escapeHtml(report.cold_email).replace(/\r?\n/g, '<br>')}</p>`,
    `<p><a href="${escapeHtml(reportUrl)}">PDF report</a></p>`,
  ]
    .filter(Boolean)
    .join('');
}

export function buildLeadPayload(input: LeadInput): LeadPayload {
  const { business, niche } = input;
  const { industry, group } = industryFor(niche);
  const domain = domainOf(business.website);

  return {
    domain,
    company: present({
      name: business.name,
      domain,
      website: business.website,
      phone: business.phone,
      // A custom property in HubSpot; an account without it still gets the lead (hubspot.ts)
      email: business.email,
      address: business.address,
      industry,
    }),
    contact: business.email
      ? {
          email: business.email,
          properties: present({ email: business.email, phone: business.phone, website: business.website, company: business.name }),
        }
      : null,
    onCreate: { company: { lifecyclestage: 'lead' }, contact: { lifecyclestage: 'lead', hs_lead_status: 'NEW' } },
    noteHtml: noteHtml(input, group),
  };
}
