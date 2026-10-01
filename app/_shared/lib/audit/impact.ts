// app/_shared/lib/audit/impact.ts

// Turns an audit into the problems a business owner reads, worst first, in the
// impact library's plain English. Client-safe (no Node-only imports).

import { isOutdatedAudit, type Finding, type FindingStatus, type LighthouseSummary } from '@/app/_shared/lib/audit/types';
import { IMPACT_LIBRARY, STATS, type ImpactEntry, type Stat } from '@/app/_shared/lib/audit/impactLibrary';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';

export interface Problem {
  id: string;
  /** The owner's version of the problem */
  problem: string;
  /** What it costs them; '' for a check the library doesn't know */
  cost: string;
  /** What we'd do about it; '' for a check the library doesn't know */
  fix: string;
  /** What was measured, e.g. "Google's mobile test: 4.2 s" */
  evidence?: string;
  stat?: Stat;
}

interface Candidate {
  id: string;
  status: FindingStatus;
  label: string;
  evidence?: string;
}

// "Slow" matches the statistic quoted with it (3 seconds); a Lighthouse score
// below 0.5 is about 4 s for LCP
const SLOW_LCP_MS = 3_000;
const POOR_SCORE = 0.5;
const IMAGE_AUDITS = ['uses-optimized-images', 'uses-webp-images', 'uses-responsive-images', 'offscreen-images'];

/** The library entry for a check's result, when that result is a problem */
export function impactFor(id: string, status: FindingStatus): ImpactEntry | undefined {
  return IMPACT_LIBRARY.find((entry) => entry.id === id && entry.status === status);
}

/** A finding in owner language, or its own label when the library has no entry */
export const plainLabel = (finding: Finding): string => impactFor(finding.id, finding.status)?.problem ?? finding.label;

const isPoor = (score: number | null | undefined) => typeof score === 'number' && score < POOR_SCORE;
const labTest = (displayValue: string | undefined) => (displayValue ? `Google's mobile test: ${displayValue}` : undefined);

/** Speed and SSL problems, read from the stored audit (they aren't findings) */
function signals(audit: AuditLike): Candidate[] {
  const mobile = (audit.raw_json as { mobile?: LighthouseSummary | null } | null)?.mobile;
  const audits = mobile?.keyAudits ?? {};
  const found: Candidate[] = [];
  const signal = (id: string, evidence: string | undefined) => found.push({ id, status: 'fail', label: id, evidence });

  // Real visitors decide when Google has them; the lab test only otherwise
  const lcp = audits['largest-contentful-paint'];
  if (mobile?.field) {
    if (mobile.field.lcpMs > SLOW_LCP_MS) {
      signal('speed.slowLoad', `Real visitors on phones wait about ${(mobile.field.lcpMs / 1000).toFixed(1)} s`);
    }
  } else if (lcp && isPoor(lcp.score)) {
    signal('speed.slowLoad', labTest(lcp.displayValue));
  }
  if (!isOutdatedAudit(audit.engine_version) && audit.ssl_valid === false) {
    signal('ssl.invalid', audit.checks?.ssl?.error);
  }
  const shift = audits['cumulative-layout-shift'];
  if (shift && isPoor(shift.score)) signal('speed.layoutShift', labTest(shift.displayValue && `layout shift ${shift.displayValue}`));
  const images = IMAGE_AUDITS.map((id) => audits[id]).find((a) => a && isPoor(a.score));
  if (images) signal('speed.heavyImages', labTest(images.displayValue));
  return found;
}

/** The audit's problems, worst first: library order, one per group, then failing checks the library doesn't know */
export function rankedProblems(audit: AuditLike): Problem[] {
  const checks = audit.checks ?? {};
  const findings = [checks.lead, checks.geo, checks.aeo, checks.seo].flatMap((c) => c?.findings ?? []);
  const candidates: Candidate[] = [
    ...signals(audit),
    ...findings
      .filter((finding) => finding.status !== 'pass')
      .map((finding) => ({ id: finding.id, status: finding.status, label: finding.label, evidence: finding.detail })),
  ];

  const known = candidates
    .map((c) => ({ c, index: IMPACT_LIBRARY.findIndex((e) => e.id === c.id && e.status === c.status) }))
    .filter(({ index }) => index !== -1)
    .sort((a, b) => a.index - b.index);
  const groups = new Set<string>();
  // A statistic is quoted once, on the first problem it supports
  const statsQuoted = new Set<string>();
  const ranked: Problem[] = [];
  for (const { c, index } of known) {
    const entry = IMPACT_LIBRARY[index];
    if (entry.group) {
      if (groups.has(entry.group)) continue;
      groups.add(entry.group);
    }
    const stat = entry.stat && !statsQuoted.has(entry.stat) ? STATS[entry.stat] : undefined;
    if (entry.stat) statsQuoted.add(entry.stat);
    ranked.push({
      id: entry.id,
      problem: entry.problem,
      cost: entry.cost,
      fix: entry.fix,
      ...(c.evidence && { evidence: c.evidence }),
      ...(stat && { stat }),
    });
  }

  // A failing check added after the library was written: shown by its own label, last
  const unknown = candidates
    .filter((c) => c.status === 'fail' && !IMPACT_LIBRARY.some((e) => e.id === c.id))
    .map((c) => ({ id: c.id, problem: c.label, cost: '', fix: '', ...(c.evidence && { evidence: c.evidence }) }));
  return [...ranked, ...unknown];
}
