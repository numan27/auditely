// app/_shared/lib/demo/landingDemo.ts

// What the landing page shows of the demo: its sample search ranked weakest site
// first, as the app's own sort ranks it, and the hero's sample with its first
// email. Read on the server from demoData; only these trimmed rows reach the
// browser, never an email address, phone number or the stored email's sign-off.

import type { DemoData } from '@/app/_shared/lib/demo/demoSamples';
import { DEMO_SIGN_OFF } from '@/app/_shared/lib/demo/unbrand';
import { SAMPLE_ID } from '@/app/_shared/lib/demo/demoData';
import { outreachDraft } from '@/app/_shared/lib/email/outreach';
import { demoReportPath } from '@/app/_shared/lib/config/routes';
import type { AuditFields, BusinessWithData } from '@/app/_shared/lib/types/auditely';
import { averageScore } from '@/app/_shared/lib/utils/leadView';

export interface LandingScore {
  label: string;
  score: number | null;
}

export interface LandingLead {
  id: string;
  rank: number;
  name: string;
  host: string;
  rating: number | null;
  reviews: number | null;
  /** The six scores the average is taken over, in SCORE_LABELS order */
  scores: LandingScore[];
  average: number | null;
  /** The lowest of the six: what the row names */
  weakest: LandingScore | null;
  summary: string;
  subject: string;
  /** The sample's PDF report */
  reportUrl: string;
}

export interface LandingSample {
  name: string;
  host: string;
  /** Where it is, as the search was typed: "Houston, TX" */
  place: string;
  rating: number | null;
  reviews: number | null;
  scores: LandingScore[];
  ssl: boolean | null;
  summary: string;
  improvements: string[];
  /** The first email, unsigned: the page signs it as the visitor */
  email: { subject: string; body: string };
}

// The scores averageScore() averages, with the labels the app's score tiles use
const SCORES: [keyof AuditFields, string][] = [
  ['performance_score', 'Performance'],
  ['seo_score', 'SEO'],
  ['mobile_score', 'Mobile'],
  ['geo_score', 'GEO'],
  ['aeo_score', 'AEO'],
  ['lead_score', 'Lead capture'],
];

export const SCORE_LABELS = SCORES.map(([, label]) => label);

const hostOf = (website: string) => new URL(website).hostname.replace(/^www\./, '');

function scoresOf(audit: AuditFields): LandingScore[] {
  return SCORES.map(([key, label]) => {
    const score = audit[key];
    return { label, score: typeof score === 'number' ? score : null };
  });
}

function weakestOf(scores: LandingScore[]): LandingScore | null {
  const measured = scores.filter((s) => s.score !== null);
  return measured.length ? measured.reduce((low, s) => (s.score! < low.score! ? s : low)) : null;
}

type Audited = BusinessWithData & { website: string; audit: NonNullable<BusinessWithData['audit']>; ai_report: NonNullable<BusinessWithData['ai_report']> };

const isAudited = (b: BusinessWithData): b is Audited => !!(b.website && b.audit && b.ai_report);

/** The sample search, weakest site first: the likeliest prospects at the top */
export function landingLeads(data: DemoData): LandingLead[] {
  const audited = data.leads.filter(isAudited);
  // A stable sort: equal averages keep the search's order, as in the app
  const ranked = audited
    .map((b) => ({ b, average: averageScore(b.audit) }))
    .sort((x, y) => (x.average ?? Infinity) - (y.average ?? Infinity));
  return ranked.map(({ b, average }, i) => {
    const scores = scoresOf(b.audit);
    return {
      id: b.id,
      rank: i + 1,
      name: b.name,
      host: hostOf(b.website),
      rating: b.rating ?? null,
      reviews: b.review_count ?? null,
      scores,
      average: average === null ? null : Math.round(average),
      weakest: weakestOf(scores),
      summary: b.ai_report.summary,
      subject: outreachDraft(b.ai_report.cold_email ?? '', b.name).subject,
      reportUrl: demoReportPath(b.audit.id),
    };
  });
}

/** The email's body without its last paragraph when that is only the placeholder sign-off */
function unsigned(body: string): string {
  const paragraphs = body.trim().split(/\n\s*\n/);
  return paragraphs.at(-1)?.trim() === DEMO_SIGN_OFF ? paragraphs.slice(0, -1).join('\n\n').trim() : body.trim();
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const COUNTRY = /^(usa|us|united states)$/i;

/** The saved search as a visitor would type it: "Cosmetic dentist" in "Houston, TX" */
export function searchLabel(query: DemoData['query']): { niche: string; location: string } {
  const parts = query.location
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !COUNTRY.test(part))
    .map((part) => (part.length === 2 ? part.toUpperCase() : part.split(/\s+/).map(capitalized).join(' ')));
  return { niche: capitalized(query.niche.trim()), location: parts.join(', ') };
}

/** The hero's and the "What you send" section's sample: the landing page's sample report */
export function landingSample(data: DemoData): LandingSample {
  const lead = data.leads.find((b) => b.id === SAMPLE_ID);
  if (!lead || !isAudited(lead)) throw new Error(`The demo data has no audited ${SAMPLE_ID}`);
  const draft = outreachDraft(lead.ai_report.cold_email ?? '', lead.name);
  return {
    name: lead.name,
    host: hostOf(lead.website),
    place: searchLabel(data.query).location,
    rating: lead.rating ?? null,
    reviews: lead.review_count ?? null,
    scores: scoresOf(lead.audit),
    ssl: lead.audit.ssl_valid ?? null,
    summary: lead.ai_report.summary,
    improvements: lead.ai_report.improvements ?? [],
    email: { subject: draft.subject, body: unsigned(draft.body) },
  };
}
