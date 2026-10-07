import { describe, it, expect } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { buildPdfProps, buildUpworkPdfProps, type AuditLike } from '@/app/_shared/lib/audit/reportData';

// What a reader of the report sees and can click: its text, and where its links go
function read(node: ReactNode, page = { text: '', links: [] as string[] }) {
  if (typeof node === 'string' || typeof node === 'number') page.text += node;
  else if (Array.isArray(node)) node.forEach((child) => read(child, page));
  else if (isValidElement<{ src?: string; children?: ReactNode }>(node)) {
    if (typeof node.type === 'function') return read((node.type as (props: unknown) => ReactNode)(node.props), page);
    if (node.props.src) page.links.push(node.props.src);
    read(node.props.children, page);
  }
  return page;
}

const audit: AuditLike = {
  created_at: '2026-09-23T12:00:00Z',
  performance_score: 42,
  seo_score: 80,
  mobile_score: 38,
  ssl_valid: true,
  geo_score: 25,
  aeo_score: 40,
  lead_score: 30,
  raw_json: {},
  checks: {},
  engine_version: 2,
};
const business = { name: 'Smile Dental', website: 'https://smiledental.com', address: '123 Main St', phone: '(713) 555-0142' };
const report = { summary: 'Slow site.', improvements: ['Compress images'] };
const contact = { name: 'Numan', phone: '+1 555 0100', email: 'contact@devartventures.com', bookingUrl: 'https://calendly.com/devart-ventures/30min' };

describe('PdfDocument', () => {
  it('gives the prospect every way to get in touch in the full report', () => {
    const page = read(PdfDocument(buildPdfProps(audit, business, report, contact)));
    expect(page.links).toEqual(
      expect.arrayContaining(['https://devartventures.com', 'https://calendly.com/devart-ventures/30min', 'mailto:contact@devartventures.com'])
    );
    expect(page.text).toContain('Want help fixing these?');
    expect(page.text).toContain('(713) 555-0142');
  });

  // Upwork removes a file that carries a way to reach someone outside it
  it('leaves nothing to click or contact in the Upwork version', () => {
    const page = read(PdfDocument(buildUpworkPdfProps(audit, business, report)));
    expect(page.links).toEqual([]);
    expect(page.text).not.toContain('@');
    expect(page.text).not.toContain('devartventures.com');
    expect(page.text).not.toContain('calendly');
    expect(page.text).not.toContain('Want help fixing these?');
    expect(page.text).not.toContain('555');
  });

  it('still says who prepared the Upwork version, and for which website', () => {
    const page = read(PdfDocument(buildUpworkPdfProps(audit, business, report)));
    expect(page.text).toContain('Prepared by DevArtVentures');
    expect(page.text).toContain('Powered by DevArtVentures');
    expect(page.text).toContain('Smile Dental');
    expect(page.text).toContain('https://smiledental.com');
    expect(page.text).toContain('Compress images');
  });
});
