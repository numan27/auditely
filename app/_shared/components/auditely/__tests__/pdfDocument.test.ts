import { describe, it, expect } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { buildPdfProps, buildUpworkPdfProps, type AuditLike } from '@/app/_shared/lib/audit/reportData';
import { resolveBrand, type Profile } from '@/app/_shared/lib/brand/brandRules';

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
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const acmeProfile: Profile = {
  email: 'sam@acme.studio',
  display_name: 'Sam Lee',
  company: 'Acme Studio',
  website: 'https://acme.studio',
  logo_data_url: PNG,
  contact_email: 'hi@acme.studio',
  contact_phone: null,
  booking_url: 'https://cal.com/acme',
};
const ownerBrand = resolveBrand({ profile: null, isOwner: true, plan: 'owner' }, contact);
const acmeBrand = resolveBrand({ profile: acmeProfile, isOwner: false, plan: 'pro' });
const auditelyBrand = resolveBrand({ profile: null, isOwner: false, plan: 'free' });

describe('PdfDocument', () => {
  it('gives the prospect every way to get in touch in the full report', () => {
    const page = read(PdfDocument(buildPdfProps(audit, business, report, ownerBrand)));
    expect(page.links).toEqual(
      expect.arrayContaining(['https://devartventures.com', 'https://calendly.com/devart-ventures/30min', 'mailto:contact@devartventures.com'])
    );
    expect(page.text).toContain('Want help fixing these?');
    expect(page.text).toContain('(713) 555-0142');
  });

  // Upwork removes a file that carries a way to reach someone outside it
  it('leaves nothing to click or contact in the Upwork version', () => {
    const page = read(PdfDocument(buildUpworkPdfProps(audit, business, report, ownerBrand)));
    expect(page.links).toEqual([]);
    expect(page.text).not.toContain('@');
    expect(page.text).not.toContain('devartventures.com');
    expect(page.text).not.toContain('calendly');
    expect(page.text).not.toContain('Want help fixing these?');
    expect(page.text).not.toContain('555');
  });

  it('still says who prepared the Upwork version, and for which website', () => {
    const page = read(PdfDocument(buildUpworkPdfProps(audit, business, report, ownerBrand)));
    expect(page.text).toContain('Prepared by DevArtVentures');
    expect(page.text).toContain('Powered by DevArtVentures');
    expect(page.text).toContain('Smile Dental');
    expect(page.text).toContain('https://smiledental.com');
    expect(page.text).toContain('Compress images');
  });

  it('says DevArtVentures exactly as today for the owner with a blank profile', () => {
    const page = read(PdfDocument(buildPdfProps(audit, business, report, ownerBrand)));
    expect(page.text).toContain('Prepared by DevArtVentures');
    expect(page.text).toContain('Powered by devartventures.com');
    expect(page.text).toContain('on a free 30-minute call, with no obligation.');
    expect(page.links).toContain('https://devartventures.com');
    expect(page.text).not.toContain('Auditely');
  });

  it('puts a paid account’s name, logo and booking link on its report', () => {
    const page = read(PdfDocument(buildPdfProps(audit, business, report, acmeBrand)));
    expect(page.text).toContain('Prepared by Acme Studio');
    expect(page.text).toContain('Powered by acme.studio');
    expect(page.text).toContain('on a free call, with no obligation.');
    expect(page.text).toContain('Sam Lee');
    expect(page.links).toEqual(expect.arrayContaining([PNG, 'https://acme.studio', 'https://cal.com/acme', 'mailto:hi@acme.studio']));
    expect(page.text.toLowerCase()).not.toContain('devart');
    expect(page.links.join(' ').toLowerCase()).not.toContain('devart');
  });

  it('names a paid account without a website, and links nothing for it', () => {
    const page = read(PdfDocument(buildPdfProps(audit, business, report, { ...acmeBrand, website: null, logo: null })));
    expect(page.text).toContain('Prepared by Acme Studio');
    expect(page.text).toContain('Powered by Acme Studio');
    expect(page.links).not.toContain('https://acme.studio');
  });

  it('gives a Free account’s report the Auditely invitation and no contact box', () => {
    const page = read(PdfDocument(buildPdfProps(audit, business, report, auditelyBrand)));
    expect(page.text).toContain('Prepared with Auditely');
    expect(page.text).toContain('Audited with Auditely');
    expect(page.text).toContain("Auditely finds local businesses and checks their websites for what's costing them customers. Try it free.");
    expect(page.text).toContain('Try Auditely free');
    expect(page.text).not.toContain('Want help fixing these?');
    expect(page.links).toContain('https://auditely.vercel.app');
    expect(page.text.toLowerCase()).not.toContain('devart');
    expect(page.links.join(' ').toLowerCase()).not.toContain('devart');
  });

  it('keeps the Upwork version free of links and contact for the owner', () => {
    const page = read(PdfDocument(buildUpworkPdfProps(audit, business, report, { ...ownerBrand, logo: { contentType: 'image/png', dataUrl: PNG } })));
    expect(page.text).toContain('Prepared by DevArtVentures');
    expect(page.links.filter((l) => !l.startsWith('data:'))).toEqual([]);
    expect(page.text).not.toContain('Want help fixing these?');
  });
});
