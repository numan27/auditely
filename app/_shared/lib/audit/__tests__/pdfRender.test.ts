import { describe, it, expect } from 'vitest';
import { pdfFileName, renderPdf, renderUpworkPdf } from '@/app/_shared/lib/audit/pdfRender';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';
import { resolveBrand } from '@/app/_shared/lib/brand/brandRules';

const audit: AuditLike = {
  created_at: '2026-09-23T12:00:00Z',
  performance_score: 42,
  seo_score: 80,
  mobile_score: 38,
  ssl_valid: true,
  geo_score: 25,
  aeo_score: 40,
  raw_json: {},
  checks: {},
  engine_version: 2,
};
const business = { name: 'Smile Dental', website: 'https://smiledental.com', address: '123 Main St', phone: '(•••) •••-••42' };
const report = { summary: 'Slow site.', improvements: ['Compress images'] };
const contact = { name: 'Numan', phone: null, email: 'contact@devartventures.com', bookingUrl: 'https://calendly.com/x/30min' };
const ownerBrand = resolveBrand({ profile: null, isOwner: true, plan: 'owner' }, contact);
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('renderPdf', () => {
  it('draws a PDF with the contact box, and a shorter one without it', async () => {
    const withContact = await renderPdf(audit, business, report, ownerBrand);
    const without = await renderPdf(audit, business, report, { ...ownerBrand, contact: null });
    expect(withContact.subarray(0, 5).toString()).toBe('%PDF-');
    expect(without.subarray(0, 5).toString()).toBe('%PDF-');
    expect(without.length).toBeLessThan(withContact.length);
  }, 30_000);
});

describe('renderPdf with a logo', () => {
  it('draws the profile’s logo into the report', async () => {
    const plain = await renderPdf(audit, business, report, ownerBrand);
    const withLogo = await renderPdf(audit, business, report, { ...ownerBrand, logo: { contentType: 'image/png', dataUrl: PNG } });
    expect(withLogo.subarray(0, 5).toString()).toBe('%PDF-');
    expect(withLogo.includes('/Subtype /Image')).toBe(true);
    expect(plain.includes('/Subtype /Image')).toBe(false);
  }, 30_000);
});

describe('renderUpworkPdf', () => {
  // A link in a PDF is an annotation with a /URI: the full report has them, this one must not
  it('draws a PDF with nothing to click', async () => {
    const full = await renderPdf(audit, business, report, ownerBrand);
    const upwork = await renderUpworkPdf(audit, business, report, ownerBrand);
    expect(upwork.subarray(0, 5).toString()).toBe('%PDF-');
    expect(full.includes('/URI')).toBe(true);
    expect(upwork.includes('/URI')).toBe(false);
  }, 30_000);
});

describe('pdfFileName', () => {
  it('names the file after the business, in lowercase with dashes', () => {
    expect(pdfFileName('Smile Dental & Co.')).toBe('audit-smile-dental-co-.pdf');
  });

  it('marks the Upwork version, so the two downloads are told apart', () => {
    expect(pdfFileName('Smile Dental', 'upwork')).toBe('audit-smile-dental-upwork.pdf');
    expect(pdfFileName('Smile Dental & Co.', 'upwork')).toBe('audit-smile-dental-co-upwork.pdf');
  });
});
