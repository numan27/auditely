// app/_shared/lib/types/auditely.ts

import type { AuditChecks } from '@/app/_shared/lib/audit/types';
import type { Socials } from '@/app/_shared/lib/utils/contactChannels';

export interface Search {
  id: string;
  niche: string;
  location: string;
  created_at: string;
}

export interface Business {
  id: string;
  search_id: string;
  name: string;
  address: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  /** Contact page on the business's site (usually a form) */
  contact_page: string | null;
  socials: Socials;
  /** When contact discovery last loaded the homepage; null = never */
  contacts_checked_at: string | null;
  created_at: string;
}

export interface Audit {
  id: string;
  business_id: string;
  // null = not measured ("—"), never 0
  performance_score: number | null;
  seo_score: number | null;
  mobile_score: number | null;
  ssl_valid: boolean | null;
  geo_score: number | null;
  aeo_score: number | null;
  /** `{}` on audits written before engine v2 */
  checks: Partial<AuditChecks>;
  engine_version: number;
  raw_json: Record<string, unknown>;
  created_at: string;
}

export interface AiReport {
  id: string;
  audit_id: string;
  summary: string;
  improvements: string[];
  cold_email: string;
  created_at: string;
}

export interface BusinessWithData extends Business {
  audit?: Audit;
  ai_report?: AiReport;
}

export type AuditStatus = 'idle' | 'loading' | 'done' | 'error';
export type ReportStatus = 'idle' | 'loading' | 'done' | 'error';
