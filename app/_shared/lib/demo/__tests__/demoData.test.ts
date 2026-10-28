import { describe, it, expect } from 'vitest';
import { CURRENT_ENGINE_VERSION } from '@/app/_shared/lib/audit/types';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { allSamples, DEMO_ID_PREFIX } from '@/app/_shared/lib/demo/demoSamples';
import { findUnmasked } from '@/app/_shared/lib/demo/mask';

const samples = allSamples(demoData);

describe('the demo capture (demoData.json)', () => {
  it('shows no readable email address or phone number', () => {
    expect(findUnmasked(demoData)).toEqual([]);
  });

  // The demo is public: it reads as anyone's account, not the owner's
  it("never names DevArtVentures or signs as its owner", () => {
    expect(JSON.stringify(demoData).match(/dev\s*art\s*ventures|numan/gi) ?? []).toEqual([]);
  });

  it('carries no outreach history', () => {
    for (const b of samples) {
      expect([b.hubspot_company_id ?? null, b.crm_sent_at ?? null, b.emailed_at ?? null]).toEqual([null, null, null]);
    }
  });

  it('uses demo ids only, linked to each other', () => {
    for (const b of samples) {
      expect(b.id.startsWith(DEMO_ID_PREFIX)).toBe(true);
      expect(b.search_id.startsWith(DEMO_ID_PREFIX)).toBe(true);
      expect(b.audit?.id.startsWith(DEMO_ID_PREFIX)).toBe(true);
      expect(b.audit?.business_id).toBe(b.id);
      expect(b.ai_report?.id.startsWith(DEMO_ID_PREFIX)).toBe(true);
      expect(b.ai_report?.audit_id).toBe(b.audit?.id);
    }
    expect(new Set(samples.map((b) => b.id)).size).toBe(samples.length);
  });

  it('has a website, an audit by the current engine and a summary for every business', () => {
    for (const b of samples) {
      expect(b.website).toBeTruthy();
      expect(b.audit?.engine_version).toBe(CURRENT_ENGINE_VERSION);
      expect(b.ai_report?.summary).toBeTruthy();
    }
  });

  it('is small enough to send with the page', () => {
    expect(demoData.leads.length).toBeGreaterThanOrEqual(2);
    expect(demoData.leads.length).toBeLessThanOrEqual(10);
    expect(demoData.sites.length).toBe(1);
  });

  it('replays only leads of the sample search, and leaves some audited from the start', () => {
    const leadIds = new Set(demoData.leads.map((b) => b.id));
    for (const id of demoData.replayIds) expect(leadIds.has(id)).toBe(true);
    expect(demoData.replayIds.length).toBeGreaterThan(0);
    expect(demoData.replayIds.length).toBeLessThan(demoData.leads.length);
  });
});
