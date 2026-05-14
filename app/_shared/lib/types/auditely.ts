// app/_shared/lib/types/auditely.ts

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
  created_at: string;
}

export interface Audit {
  id: string;
  business_id: string;
  performance_score: number;
  seo_score: number;
  mobile_score: number;
  ssl_valid: boolean;
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
