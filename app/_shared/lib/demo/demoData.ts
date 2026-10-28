// app/_shared/lib/demo/demoData.ts

// The public demo's sample data, written by scripts/captureDemo.mjs. Import it
// on the server only (the demo page, its PDF route and the landing page): a
// client import would put the whole file in the browser's JavaScript as well.

import data from '@/app/_shared/lib/demo/demoData.json';
import type { DemoData } from '@/app/_shared/lib/demo/demoSamples';
import type { AuditFields } from '@/app/_shared/lib/types/auditely';

export const demoData = data as unknown as DemoData;

/** The landing page's sample report: the first lead of the demo's search */
const SAMPLE_ID = 'demo-b1';

export interface SampleReportData {
  name: string;
  website: string;
  audit: AuditFields;
  report: { summary: string; improvements: string[] };
}

/** The sample's audit and summary, without the outreach email or database ids */
export function sampleReportData(): SampleReportData {
  const lead = demoData.leads.find((b) => b.id === SAMPLE_ID);
  if (!lead?.website || !lead.audit || !lead.ai_report) throw new Error(`The demo data has no audited ${SAMPLE_ID}`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, business_id, created_at, ...audit } = lead.audit;
  return {
    name: lead.name,
    website: lead.website,
    audit,
    report: { summary: lead.ai_report.summary, improvements: lead.ai_report.improvements ?? [] },
  };
}
