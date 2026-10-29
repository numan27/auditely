// The Brand studio's design on the PDF report: its colours, type and header
// (pdfStyles), and the sections, titles, icons and wording PdfDocument draws.

import { describe, it, expect } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { pdfStyles } from '@/app/_shared/components/auditely/pdfDocument/pdfStyles';
import { buildPdfProps, buildUpworkPdfProps, type AuditLike } from '@/app/_shared/lib/audit/reportData';
import { DEFAULT_DESIGN, readDesign, type BrandDesign } from '@/app/_shared/lib/brand/brandDesign';
import { ICONS } from '@/app/_shared/lib/brand/brandIcons';
import { resolveBrand, type Profile } from '@/app/_shared/lib/brand/brandRules';

// The report's text, and every drawn path with its colour
function read(node: ReactNode, page = { text: '', paths: [] as { d: string; stroke?: string }[] }) {
  if (typeof node === 'string' || typeof node === 'number') page.text += node;
  else if (Array.isArray(node)) node.forEach((child) => read(child, page));
  else if (isValidElement<{ d?: string; stroke?: string; children?: ReactNode }>(node)) {
    if (typeof node.type === 'function') return read((node.type as (props: unknown) => ReactNode)(node.props), page);
    if (node.props.d) page.paths.push({ d: node.props.d, stroke: node.props.stroke });
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
const business = { name: 'Smile Dental', website: 'https://smiledental.com', address: '123 Main St', phone: null };
const report = { summary: 'Slow site.', improvements: ['Compress images'] };
const profile: Profile = {
  email: 'sam@acme.studio',
  display_name: 'Sam Lee',
  company: 'Acme Studio',
  website: 'https://acme.studio',
  logo_data_url: null,
  contact_email: 'hi@acme.studio',
  contact_phone: null,
  booking_url: 'https://cal.com/acme',
};
const branded = (design: unknown) => resolveBrand({ profile: { ...profile, brand_design: design }, isOwner: false, plan: 'pro' });
const pdf = (design: unknown) => read(PdfDocument(buildPdfProps(audit, business, report, branded(design))));

describe('pdfStyles', () => {
  it('keeps today’s colours and Helvetica for the default design', () => {
    const s = pdfStyles(DEFAULT_DESIGN);
    expect(s.page.fontFamily).toBe('Helvetica');
    expect(s.headerTitle.fontFamily).toBe('Helvetica-Bold');
    expect(s.sectionLabel.color).toBe('#6366f1');
    expect(s.header.borderBottomColor).toBe('#6366f1');
    expect(s.ctaBox.backgroundColor).toBe('#eef2ff');
    expect(s.ctaButton).toMatchObject({ backgroundColor: '#6366f1', color: '#ffffff' });
  });

  it('puts the accent on titles, links, the header rule and a tint behind the next step', () => {
    const s = pdfStyles({ ...DEFAULT_DESIGN, accent: '#0e7490' });
    expect(s.sectionLabel.color).toBe('#0e7490');
    expect(s.link.color).toBe('#0e7490');
    expect(s.header.borderBottomColor).toBe('#0e7490');
    expect(s.bulletNum.color).toBe('#0e7490');
    expect(s.ctaBox.backgroundColor).not.toBe('#eef2ff');
    // The button follows the accent until it has a colour of its own
    expect(s.ctaButton.backgroundColor).toBe('#0e7490');
  });

  it('writes the button in a colour that reads on it', () => {
    const s = pdfStyles({ ...DEFAULT_DESIGN, button: '#f9cf6e' });
    expect(s.ctaButton).toMatchObject({ backgroundColor: '#f9cf6e', borderColor: '#f9cf6e', color: '#111827' });
    expect(s.ctaButtonSecondary.color).toBe('#f9cf6e');
  });

  it('sets the whole report in the chosen typeface', () => {
    const serif = pdfStyles({ ...DEFAULT_DESIGN, font: 'serif' });
    expect(serif.page.fontFamily).toBe('Times-Roman');
    expect(serif.sectionLabel.fontFamily).toBe('Times-Bold');
    expect(pdfStyles({ ...DEFAULT_DESIGN, font: 'mono' }).businessName.fontFamily).toBe('Courier-Bold');
  });

  it('draws a band of the accent behind the header, with the title in a colour that reads on it', () => {
    const s = pdfStyles({ ...DEFAULT_DESIGN, accent: '#0e7490', header: 'band' });
    expect(s.header.backgroundColor).toBe('#0e7490');
    expect(s.header.borderBottomWidth ?? 0).toBe(0);
    expect(s.headerTitle.color).toBe('#ffffff');
    expect(s.headerLink.color).toBe('#ffffff');
    expect(pdfStyles({ ...DEFAULT_DESIGN, header: 'plain' }).header.borderBottomWidth ?? 0).toBe(0);
  });
});

describe('PdfDocument with a design', () => {
  const sections = (patch: Record<string, Partial<BrandDesign['sections'][number]>>) =>
    DEFAULT_DESIGN.sections.map((s) => ({ ...s, ...patch[s.id] }));

  it('draws the default design exactly as today', () => {
    const page = pdf(null);
    expect(page.text).toContain('Website Audit Report');
    expect(page.text).toContain("How We'd Fix It");
    expect(page.text).toContain('on a free call, with no obligation.');
    expect(page.text).toContain('Book your free call');
    expect(page.paths.filter((p) => p.d !== 'M5 12.5l4.5 4.5L19 7.5')).toEqual([]);
  });

  it('uses the design’s title, section titles and the next step’s wording', () => {
    const page = pdf({
      title: 'Website health check',
      ctaText: 'Let’s fix these together.',
      ctaButton: 'Pick a time',
      sections: sections({ fixes: { title: 'Our plan' }, nextStep: { title: 'Ready when you are' } }),
    });
    expect(page.text).toContain('Website health check');
    expect(page.text).not.toContain('Website Audit Report');
    expect(page.text).toContain('Our plan');
    expect(page.text).not.toContain("How We'd Fix It");
    expect(page.text).toContain('Ready when you are');
    expect(page.text).toContain('Let’s fix these together.');
    expect(page.text).toContain('Pick a time');
    expect(page.text).not.toContain('Book your free call');
  });

  it('shows the sections in the design’s order and leaves hidden ones out', () => {
    const design = readDesign({ sections: [{ id: 'summary', title: 'In short' }, { id: 'scores' }, { id: 'fixes', hidden: true }] });
    const page = pdf(design);
    expect(page.text.indexOf('In short')).toBeLessThan(page.text.indexOf('Audit Scores'));
    expect(page.text).not.toContain("How We'd Fix It");
    expect(page.text).not.toContain('Compress images');
  });

  it('leaves out the next step box when the design hides it', () => {
    const page = pdf({ sections: sections({ nextStep: { hidden: true } }) });
    expect(page.text).not.toContain('Want help fixing these?');
    expect(page.text).toContain('Summary');
  });

  it('draws a section’s icon in the accent beside its title', () => {
    const page = pdf({ accent: '#0e7490', sections: sections({ scores: { icon: 'gauge' } }) });
    expect(page.paths).toEqual(expect.arrayContaining(ICONS.gauge.paths.map((d) => ({ d, stroke: '#0e7490' }))));
  });

  it('drops characters the PDF’s fonts can’t draw from the design’s wording', () => {
    const page = pdf({ title: 'Check-up 🚀 time', sections: sections({ summary: { title: 'Résumé → next' } }) });
    expect(page.text).toContain('Check-up  time');
    expect(page.text).toContain('Résumé -> next');
  });

  it('keeps the Upwork version free of the next step whatever the design says', () => {
    const page = read(PdfDocument(buildUpworkPdfProps(audit, business, report, branded({ ctaButton: 'Pick a time' }))));
    expect(page.text).not.toContain('Pick a time');
  });
});
