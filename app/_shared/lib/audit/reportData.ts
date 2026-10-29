// app/_shared/lib/audit/reportData.ts

// Shared formatting for everything that presents an audit: the PDF and the
// dashboard. Client-safe (no Node-only imports).

import { isOutdatedAudit, type AuditChecks, type Finding, type KeyAudit } from '@/app/_shared/lib/audit/types';
import { impactFor, plainLabel, rankedProblems } from '@/app/_shared/lib/audit/impact';
import type { BrandDesign } from '@/app/_shared/lib/brand/brandDesign';
import type { Brand } from '@/app/_shared/lib/brand/brandRules';
import type { PdfBrand, PdfDocumentProps, PdfFinding, PdfProblem } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';

export interface IssueSummary {
  title: string;
  displayValue?: string;
}

/** The audit fields presentation code reads (DB rows from any engine version). */
export interface AuditLike {
  created_at: string;
  performance_score: number | null;
  seo_score: number | null;
  mobile_score: number | null;
  ssl_valid: boolean | null;
  geo_score?: number | null;
  aeo_score?: number | null;
  lead_score?: number | null;
  raw_json: unknown;
  checks?: Partial<AuditChecks> | null;
  engine_version?: number | null;
}

export type ScoreTone = 'good' | 'ok' | 'poor' | 'none';

const FINDING_ORDER: Record<Finding['status'], number> = { fail: 0, warn: 1, pass: 2 };

export const formatScore = (score: number | null | undefined): string =>
  typeof score === 'number' ? `${score}/100` : 'not measured';

export const formatSsl = (valid: boolean | null | undefined): string =>
  valid === true ? 'valid' : valid === false ? 'invalid or missing' : 'not measured';

const UNREAD_AFTER =
  "so GEO, AEO and lead capture couldn't be checked. Performance, SEO, mobile and SSL come from Google and aren't affected.";

/** Why the site couldn't be read at all (no GEO, AEO or lead capture checks), or null */
export function unreadSiteReason(checks: Partial<AuditChecks> | null | undefined): string | null {
  const { geo, aeo, lead, site } = checks ?? {};
  return !geo && !aeo && !lead && site?.reason ? site.reason : null;
}

/** The site's bot protection turned the audit away, so GEO, AEO and lead capture have no scores */
export const siteBlocked = (checks: Partial<AuditChecks> | null | undefined): boolean =>
  !!unreadSiteReason(checks)?.startsWith('Blocked');

/** Why GEO, AEO and lead capture weren't checked, in words a user (or prospect) understands. */
export function siteNotice(reason: string): { title: string; body: string } {
  // "Blocked (403)" / "Blocked (bot challenge)": the site's bot protection turned the audit away
  if (reason.startsWith('Blocked')) {
    return { title: 'This website blocked our checks', body: `It turns away automated visitors, ${UNREAD_AFTER}` };
  }
  const http = /^HTTP (\d{3})$/.exec(reason);
  const why = /timed out$/.test(reason)
    ? 'It took too long to answer'
    : /unreachable$/.test(reason)
      ? "It didn't respond"
      : http
        ? `Its home page answered with an error (${http[1]})`
        : `The site check said: ${reason}`;
  return { title: "We couldn't read this website", body: `${why}, ${UNREAD_AFTER}` };
}

export function scoreTone(score: number | null | undefined): ScoreTone {
  if (typeof score !== 'number') return 'none';
  if (score >= 80) return 'good';
  if (score >= 50) return 'ok';
  return 'poor';
}

/** Worst Lighthouse audits (score < 0.9), worst first. */
export function topLighthouseIssues(rawJson: unknown, limit: number): IssueSummary[] {
  const mobile = (rawJson as { mobile?: { keyAudits?: Record<string, KeyAudit> } | null } | null)?.mobile;
  return Object.values(mobile?.keyAudits ?? {})
    .filter((a): a is KeyAudit & { score: number } => typeof a.score === 'number' && a.score < 0.9)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((a) => ({ title: a.title, ...(a.displayValue && { displayValue: a.displayValue }) }));
}

/** fail → warn → pass, keeping the original order within each group. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => FINDING_ORDER[a.status] - FINDING_ORDER[b.status]);
}

// v1 audits never measured SEO or SSL (their 0 / false meant "unknown")
export function measuredSeoAndSsl(audit: AuditLike): { seo: number | null; ssl: boolean | null } {
  return isOutdatedAudit(audit.engine_version)
    ? { seo: null, ssl: null }
    : { seo: audit.seo_score, ssl: audit.ssl_valid };
}

// The PDF uses the built-in Helvetica (WinAnsi encoding): Unicode spaces render
// as "/", non-breaking hyphens vanish and arrows don't exist. The AI model emits
// the first two; finding labels use the arrow.
const pdfText = (text: string): string =>
  text
    .replace(/\u2192/g, '->')
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/[\u2010-\u2012\u2212]/g, '-');

const PDF_FINDINGS_LIMIT = 6;
const PDF_PROBLEMS_LIMIT = 4;

// A failure, or a warning the impact library treats as a problem. "Couldn't
// check" results and listing gaps have no entry, so they never reach a prospect.
const isProblem = (finding: Finding) =>
  finding.status === 'fail' || (finding.status === 'warn' && !!impactFor(finding.id, 'warn'));

// Problems only (fail, then warn) — the PDF is a list of what to fix
function pdfFindings(findings: Finding[] | undefined): PdfFinding[] {
  return sortFindings((findings ?? []).filter(isProblem))
    .slice(0, PDF_FINDINGS_LIMIT)
    .map((finding) => ({
      status: finding.status as PdfFinding['status'],
      label: pdfText(plainLabel(finding)),
      ...(finding.detail && { detail: pdfText(finding.detail) }),
    }));
}

type ReportBusiness = { name: string; website: string | null; address: string; phone: string | null };

/** The business's name, or its website's, once Google's details were blanked after 30 days (placeDataErase.ts) */
function reportName({ name, website }: ReportBusiness): string {
  if (name.trim()) return name;
  try {
    return new URL(website ?? '').hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'Your business';
  }
}

// Beyond pdfText's fixes, anything the built-in fonts' WinAnsi encoding has no
// glyph for (emoji, most scripts other than Latin) is dropped from words typed
// in the Brand studio rather than drawn as gibberish
const NOT_WINANSI = /[^\u0000-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018-\u201a\u201c-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/gu;
const designText = (text: string | null): string | null => text && pdfText(text).replace(NOT_WINANSI, '');

/** The design with every word it adds made safe for the PDF */
function pdfDesign(design: BrandDesign): BrandDesign {
  return {
    ...design,
    title: designText(design.title),
    ctaText: designText(design.ctaText),
    ctaButton: designText(design.ctaButton),
    sections: design.sections.map((section) => ({ ...section, title: designText(section.title) })),
  };
}

/** What the PDF says about whose report it is */
export function pdfBrand(brand: Brand): PdfBrand {
  return {
    name: pdfText(brand.name),
    website: brand.website,
    logo: brand.logo?.dataUrl ?? null,
    invite: brand.kind === 'auditely',
    call: brand.call,
    design: pdfDesign(brand.design),
  };
}

type ReportText = { summary: string; improvements: unknown };

export function buildPdfProps(
  audit: AuditLike,
  business: ReportBusiness,
  report: ReportText,
  // The account's brand; its contact null leaves out the "next step" box (the public demo)
  brand: Brand
): PdfDocumentProps {
  const { contact } = brand;
  const problems = rankedProblems(audit).slice(0, PDF_PROBLEMS_LIMIT);
  const { seo, ssl } = measuredSeoAndSsl(audit);
  const improvements = Array.isArray(report.improvements)
    ? report.improvements.filter((item): item is string => typeof item === 'string').map(pdfText)
    : [];

  return {
    businessName: pdfText(reportName(business)),
    website: business.website ?? '',
    address: pdfText(business.address),
    phone: business.phone && pdfText(business.phone),
    auditDate: new Date(audit.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }),
    performanceScore: audit.performance_score,
    seoScore: seo,
    mobileScore: audit.mobile_score,
    sslValid: ssl,
    geoScore: audit.geo_score ?? null,
    aeoScore: audit.aeo_score ?? null,
    problems: problems.map(
      (p): PdfProblem => ({
        problem: pdfText(p.problem),
        cost: pdfText(p.cost),
        ...(p.evidence && { evidence: pdfText(p.evidence) }),
        // The source sits right beside the claim
        ...(p.stat && { stat: pdfText(`${p.stat.text} (${p.stat.source})`) }),
      })
    ),
    geoFindings: pdfFindings(audit.checks?.geo?.findings),
    aeoFindings: pdfFindings(audit.checks?.aeo?.findings),
    leadScore: audit.lead_score ?? null,
    leadFindings: pdfFindings(audit.checks?.lead?.findings),
    summary: pdfText(report.summary),
    improvements,
    brand: pdfBrand(brand),
    contact: contact && {
      ...contact,
      name: contact.name && pdfText(contact.name),
      phone: contact.phone && pdfText(contact.phone),
    },
  };
}

/**
 * The report to attach on Upwork, which removes a file that carries a way to
 * reach someone outside it: no "next step" box, no links and no phone number.
 */
export function buildUpworkPdfProps(audit: AuditLike, business: ReportBusiness, report: ReportText, brand: Brand): PdfDocumentProps {
  return { ...buildPdfProps(audit, { ...business, phone: null }, report, { ...brand, contact: null }), links: false };
}
