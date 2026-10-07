import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';

// Fake Supabase: one audit with its business, and its newest AI report
const db = vi.hoisted(() => {
  const state = { audit: null as unknown, report: null as unknown };
  const from = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      single: async () => ({ data: table === 'audits' ? state.audit : null, error: null }),
      maybeSingle: async () => ({ data: table === 'ai_reports' ? state.report : null, error: null }),
    };
    return chain;
  };
  return { state, from };
});

vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));

const AUDIT = '3f2b7c1e-8a4d-4f6b-9c2e-1d5a7b9e0c3f';

beforeEach(() => {
  db.state.audit = {
    id: AUDIT, business_id: 'b1', created_at: '2026-10-01T00:00:00Z', engine_version: 2, performance_score: 50, seo_score: 80,
    mobile_score: 40, ssl_valid: true, geo_score: 25, aeo_score: 40, lead_score: 30, raw_json: {}, checks: {},
    businesses: { id: 'b1', name: 'Smile Dental', address: '1 Main St', website: 'https://smiledental.com', phone: '(713) 555-0142' },
  };
  db.state.report = { id: 'r1', audit_id: AUDIT, summary: 'Slow site.', improvements: ['Compress images'], cold_email: 'E', created_at: '2026-10-01T00:00:00Z' };
});

describe('renderAuditPdf', () => {
  it('draws the full report, with its links, unless asked otherwise', async () => {
    const result = await renderAuditPdf(AUDIT);
    if (!result.ok) throw new Error(result.error);
    expect(result.filename).toBe('audit-smile-dental.pdf');
    expect(result.pdf.includes('/URI')).toBe(true);
  }, 30_000);

  it('draws the Upwork version without a link, under its own file name', async () => {
    const result = await renderAuditPdf(AUDIT, 'upwork');
    if (!result.ok) throw new Error(result.error);
    expect(result.filename).toBe('audit-smile-dental-upwork.pdf');
    expect(result.pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(result.pdf.includes('/URI')).toBe(false);
  }, 30_000);

  it('has no Upwork version either before the AI report is written', async () => {
    db.state.report = null;
    expect(await renderAuditPdf(AUDIT, 'upwork')).toEqual({ ok: false, status: 404, error: 'AI report not found — generate the report first' });
  });
});
