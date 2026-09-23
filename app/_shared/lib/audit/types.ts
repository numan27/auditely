// app/_shared/lib/audit/types.ts

// Shared audit-engine types. Safe to import from client components
// (no Node-only imports in this file).

export const CURRENT_ENGINE_VERSION = 2;

/** Audits written by an older engine are shown as "Outdated". */
export const isOutdatedAudit = (engineVersion: number | null | undefined): boolean =>
  (engineVersion ?? 1) < CURRENT_ENGINE_VERSION;

export type FindingStatus = 'pass' | 'warn' | 'fail';

// `id` is stable — Project B keys its plain-English impact translations on it
export interface Finding {
  id: string;
  status: FindingStatus;
  label: string;
  detail?: string;
}

export type NapStatus = 'match' | 'mismatch' | 'missing' | 'n/a';

export interface KeyAudit {
  score: number | null;
  title: string;
  displayValue?: string;
}

export interface LighthouseSummary {
  categories: Record<string, { score: number | null; title: string }>;
  keyAudits: Record<string, KeyAudit>;
}

export interface SslCheck {
  valid: boolean | null;
  daysToExpiry: number | null;
  issuer: string | null;
  error?: string;
}

export type RobotsTxtStatus = 'ok' | 'missing' | 'blocks-all' | 'unknown';

export interface SeoBasics {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  viewport: boolean;
  noindex: boolean;
  robotsTxt: RobotsTxtStatus;
  findings: Finding[];
}

export interface NapResult {
  name: NapStatus;
  address: NapStatus;
  phone: NapStatus;
  site: { name: string | null; address: string | null; phones: string[] };
}

export interface GeoChecks {
  findings: Finding[];
  schemaTypes: string[];
  nap: NapResult;
}

export interface AeoChecks {
  findings: Finding[];
  h1Count: number;
  h2Count: number;
  questionHeadings: number;
  hasFaqSchema: boolean;
}

export interface AuditChecks {
  ssl: SslCheck;
  seo: SeoBasics | null;
  geo: GeoChecks | null;
  aeo: AeoChecks | null;
  site: { ok: boolean; finalUrl: string | null; status: number | null; reason?: string };
  psi: { mobile: string; desktop: string }; // 'ok' or the failure reason
}

export interface AuditInput {
  website: string;
  name: string;
  address: string;
  phone: string | null;
  niche: string | null;
  /** Called once the homepage is fetched (html is null if it couldn't be read). */
  discoverEmail?: (homepageHtml: string | null) => Promise<string | null>;
}

/** Columns written to `audits` (besides id / business_id / created_at). */
export interface AuditRow {
  performance_score: number | null;
  seo_score: number | null;
  mobile_score: number | null;
  ssl_valid: boolean | null;
  geo_score: number | null;
  aeo_score: number | null;
  checks: AuditChecks;
  raw_json: { mobile: LighthouseSummary | null; desktop: LighthouseSummary | null };
  engine_version: number;
}

export interface AuditOutcome {
  row: AuditRow;
  email: string | null;
}
