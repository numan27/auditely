// app/_shared/lib/demo/demoSamples.ts

// The shape of the public demo's sample data and what is read from it. The data
// itself (demoData.json) is loaded on the server only, in demoData.ts.

import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

export const DEMO_ID_PREFIX = 'demo-';

export interface DemoData {
  /** When the capture script wrote the file */
  capturedAt: string;
  query: { niche: string; location: string };
  /** The sample search, each business with its audit and AI report */
  leads: BusinessWithData[];
  /** The Audit tab's sample websites */
  sites: BusinessWithData[];
  /** Leads shown as "Not audited yet" until the visitor replays their audit */
  replayIds: string[];
}

/** The search as a visitor first sees it: the audits of `replayIds` held back */
export function startingLeads(data: DemoData): BusinessWithData[] {
  const held = new Set(data.replayIds);
  return data.leads.map((business) => (held.has(business.id) ? { ...business, audit: undefined, ai_report: undefined } : business));
}

/** Every sample business with its audit and report: what the replay and the PDFs answer from */
export const allSamples = (data: DemoData): BusinessWithData[] => [...data.leads, ...data.sites];
