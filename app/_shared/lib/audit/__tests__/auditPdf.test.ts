import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';
import { renderPdf } from '@/app/_shared/lib/audit/pdfRender';
import { BRAND_UNAVAILABLE, BrandUnavailable } from '@/app/_shared/lib/brand/brand';
import { resolveBrand } from '@/app/_shared/lib/brand/brandRules';
import type { Db } from '@/app/_shared/lib/supabase/client';

// The brand of the business's account; brand.test.ts reads profiles for real
const brandFor = vi.hoisted(() => vi.fn());
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
// The real renderer, which one test makes fail
vi.mock('@/app/_shared/lib/audit/pdfRender', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/app/_shared/lib/audit/pdfRender')>();
  return { ...real, renderPdf: vi.fn(real.renderPdf) };
});
vi.mock('@/app/_shared/lib/brand/brand', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/brand/brand')>()),
  brandFor,
}));
const ownerBrand = resolveBrand({ profile: null, isOwner: true, plan: 'owner' });
const auditelyBrand = resolveBrand({ profile: null, isOwner: false, plan: 'free' });

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

const fakeDb = { from: db.from } as unknown as Db;
const AUDIT = '3f2b7c1e-8a4d-4f6b-9c2e-1d5a7b9e0c3f';

beforeEach(() => {
  db.state.audit = {
    id: AUDIT, business_id: 'b1', created_at: '2026-10-01T00:00:00Z', engine_version: 2, performance_score: 50, seo_score: 80,
    mobile_score: 40, ssl_valid: true, geo_score: 25, aeo_score: 40, lead_score: 30, raw_json: {}, checks: {},
    businesses: { id: 'b1', user_id: 'u2', name: 'Smile Dental', address: '1 Main St', website: 'https://smiledental.com', phone: '(713) 555-0142' },
  };
  brandFor.mockReset().mockResolvedValue(ownerBrand);
  db.state.report = { id: 'r1', audit_id: AUDIT, summary: 'Slow site.', improvements: ['Compress images'], cold_email: 'E', created_at: '2026-10-01T00:00:00Z' };
});

describe('renderAuditPdf', () => {
  it('draws the full report, with its links, unless asked otherwise', async () => {
    const result = await renderAuditPdf(fakeDb, AUDIT);
    if (!result.ok) throw new Error(result.error);
    expect(result.filename).toBe('audit-smile-dental.pdf');
    expect(result.pdf.includes('/URI')).toBe(true);
  }, 30_000);

  it('draws the Upwork version without a link, under its own file name', async () => {
    const result = await renderAuditPdf(fakeDb, AUDIT, 'upwork');
    if (!result.ok) throw new Error(result.error);
    expect(result.filename).toBe('audit-smile-dental-upwork.pdf');
    expect(result.pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(result.pdf.includes('/URI')).toBe(false);
  }, 30_000);

  it('has no Upwork version either before the AI report is written', async () => {
    db.state.report = null;
    expect(await renderAuditPdf(fakeDb, AUDIT, 'upwork')).toEqual({
      ok: false,
      status: 404,
      error: "The summary isn't written yet. Download the PDF once it shows.",
    });
  });

  it("says plainly when the audit isn't there", async () => {
    db.state.audit = null;
    expect(await renderAuditPdf(fakeDb, AUDIT)).toEqual({
      ok: false,
      status: 404,
      error: "Couldn't find this audit. Refresh the page and try again.",
    });
  });

  it("says plainly when the PDF can't be drawn", async () => {
    vi.mocked(renderPdf).mockRejectedValueOnce(new Error('font missing'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await renderAuditPdf(fakeDb, AUDIT)).toEqual({ ok: false, status: 500, error: "Couldn't make the PDF. Try again in a minute." });
  });

  it('draws the report in the brand of the business’s account', async () => {
    brandFor.mockResolvedValue(auditelyBrand);
    const result = await renderAuditPdf(fakeDb, AUDIT);
    if (!result.ok) throw new Error(result.error);
    expect(brandFor).toHaveBeenCalledWith('u2');
    // The invitation's one link to Auditely
    expect(result.pdf.includes('auditely.vercel.app')).toBe(true);
    expect(result.pdf.includes('devartventures')).toBe(false);
  }, 30_000);

  it('answers 503 when the branding can’t be read', async () => {
    brandFor.mockRejectedValue(new BrandUnavailable('timeout'));
    expect(await renderAuditPdf(fakeDb, AUDIT)).toEqual({ ok: false, status: 503, error: BRAND_UNAVAILABLE });
  });
});
