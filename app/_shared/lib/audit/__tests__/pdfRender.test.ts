import { describe, it, expect } from 'vitest';
import { pdfFileName, renderPdf } from '@/app/_shared/lib/audit/pdfRender';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';

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

describe('renderPdf', () => {
  it('draws a PDF with the contact box, and a shorter one without it', async () => {
    const withContact = await renderPdf(audit, business, report, contact);
    const without = await renderPdf(audit, business, report, null);
    expect(withContact.subarray(0, 5).toString()).toBe('%PDF-');
    expect(without.subarray(0, 5).toString()).toBe('%PDF-');
    expect(without.length).toBeLessThan(withContact.length);
  }, 30_000);
});

describe('pdfFileName', () => {
  it('names the file after the business, in lowercase with dashes', () => {
    expect(pdfFileName('Smile Dental & Co.')).toBe('audit-smile-dental-co-.pdf');
  });
});
