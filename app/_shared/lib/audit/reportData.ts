// app/_shared/lib/audit/reportData.ts

// Shared formatting for everything that presents an audit: the AI prompt, the
// PDF and the dashboard. Client-safe (no Node-only imports).

import { isOutdatedAudit, type AuditChecks, type Finding, type KeyAudit } from '@/app/_shared/lib/audit/types';
import type { PdfContact, PdfDocumentProps, PdfFinding } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';

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

/** The site-read failure reason in words a user (or prospect) understands. */
export function siteReasonText(reason: string): string {
  // "Blocked (403)" / "Blocked (bot challenge)": the site's bot protection turned the audit away
  if (reason.startsWith('Blocked')) {
    return "This website blocks automated visitors, so GEO and AEO couldn't be checked. The PageSpeed scores come from Google and aren't affected.";
  }
  return `Couldn't read site: ${reason}`;
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

/** Failing (status 'fail') lead capture findings, then GEO, then AEO. */
export function failingFindings(checks: Partial<AuditChecks> | null | undefined, limit: number): Finding[] {
  return [...(checks?.lead?.findings ?? []), ...(checks?.geo?.findings ?? []), ...(checks?.aeo?.findings ?? [])]
    .filter((finding) => finding.status === 'fail')
    .slice(0, limit);
}

/** fail → warn → pass, keeping the original order within each group. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => FINDING_ORDER[a.status] - FINDING_ORDER[b.status]);
}

// v1 audits never measured SEO or SSL (their 0 / false meant "unknown")
function measuredSeoAndSsl(audit: AuditLike): { seo: number | null; ssl: boolean | null } {
  return isOutdatedAudit(audit.engine_version)
    ? { seo: null, ssl: null }
    : { seo: audit.seo_score, ssl: audit.ssl_valid };
}

/** Score lines and issue bullets for the AI prompt. */
export function auditFacts(audit: AuditLike): { scores: string; issues: string } {
  const { seo, ssl } = measuredSeoAndSsl(audit);
  const scores = [
    `Performance Score: ${formatScore(audit.performance_score)}`,
    `SEO Score: ${formatScore(seo)}`,
    `Mobile Score: ${formatScore(audit.mobile_score)}`,
    `SSL Certificate: ${formatSsl(ssl)}`,
    `GEO Score (visibility in AI search engines): ${formatScore(audit.geo_score)}`,
    `AEO Score (readiness for answer engines like ChatGPT and Perplexity): ${formatScore(audit.aeo_score)}`,
    `Lead capture (can visitors call, message or book): ${formatScore(audit.lead_score)}`,
  ].join('\n');

  const issues =
    [
      ...topLighthouseIssues(audit.raw_json, 6).map((a) => `- ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`),
      // Details (e.g. which links are broken) let the email name the problem
      ...failingFindings(audit.checks, 4).map((finding) => `- ${finding.label}${finding.detail ? ` (${finding.detail})` : ''}`),
    ].join('\n') || 'No specific issues identified.';

  return { scores, issues };
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

// Problems only (fail, then warn) — the PDF is a list of what to fix
function pdfFindings(findings: Finding[] | undefined): PdfFinding[] {
  return sortFindings((findings ?? []).filter((finding) => finding.status !== 'pass'))
    .slice(0, PDF_FINDINGS_LIMIT)
    .map((finding) => ({
      status: finding.status as PdfFinding['status'],
      label: pdfText(finding.label),
      ...(finding.detail && { detail: pdfText(finding.detail) }),
    }));
}

export function buildPdfProps(
  audit: AuditLike,
  business: { name: string; website: string | null; address: string; phone: string | null },
  report: { summary: string; improvements: unknown },
  contact: PdfContact
): PdfDocumentProps {
  const topIssues = topLighthouseIssues(audit.raw_json, 4);
  const { seo, ssl } = measuredSeoAndSsl(audit);
  const improvements = Array.isArray(report.improvements)
    ? report.improvements.filter((item): item is string => typeof item === 'string').map(pdfText)
    : [];

  return {
    businessName: pdfText(business.name),
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
    topIssues:
      topIssues.length > 0
        ? topIssues.map((issue) => ({
            title: pdfText(issue.title),
            ...(issue.displayValue && { displayValue: pdfText(issue.displayValue) }),
          }))
        : undefined,
    geoFindings: pdfFindings(audit.checks?.geo?.findings),
    aeoFindings: pdfFindings(audit.checks?.aeo?.findings),
    leadScore: audit.lead_score ?? null,
    leadFindings: pdfFindings(audit.checks?.lead?.findings),
    summary: pdfText(report.summary),
    improvements,
    contact,
  };
}
