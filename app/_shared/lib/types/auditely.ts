// app/_shared/lib/types/auditely.ts

import type { AuditChecks } from '@/app/_shared/lib/audit/types';
import type { Socials } from '@/app/_shared/lib/utils/contactChannels';
import type { EmailCheck } from '@/app/_shared/lib/email/emailCheck';

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
  /** When the paid email APIs were tried (automatically once, or via "Find email"); null = never */
  email_lookup_at: string | null;
  /** Google rating (1–5); null when unrated or found before ratings were stored */
  rating: number | null;
  /** Google review count; null when unknown (older searches, providers without reviews) */
  review_count: number | null;
  /** The HubSpot company this lead was sent to; absent before the HubSpot migration */
  hubspot_company_id?: string | null;
  /** When the lead was last sent to HubSpot */
  crm_sent_at?: string | null;
  /** When the outreach email was last sent from Auditely; absent before the emailed-at migration */
  emailed_at?: string | null;
  /** What Verifalia said about the email address; absent before the email-check migration */
  email_check?: EmailCheck | null;
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
  /** null = not measured; absent on rows read before the lead-capture migration */
  lead_score?: number | null;
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

/** What a business card found or produced, merged back into the results list */
export type BusinessUpdate = Partial<
  Pick<BusinessWithData, 'email' | 'audit' | 'ai_report' | 'crm_sent_at' | 'emailed_at' | 'email_check'>
>;

export type AuditStatus = 'idle' | 'loading' | 'done' | 'error';
export type ReportStatus = 'idle' | 'loading' | 'done' | 'error';

/** An audit's PDF report: the full one, or the one to attach on Upwork (no contact details, nothing to click) */
export type PdfVariant = 'full' | 'upwork';
