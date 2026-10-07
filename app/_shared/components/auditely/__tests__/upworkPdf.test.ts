import { describe, it, expect } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BusinessCard } from '@/app/_shared/components/auditely/businessCard/businessCard';
import { demoLinks } from '@/app/_shared/lib/demo/demoLinks';
import type { DemoData } from '@/app/_shared/lib/demo/demoSamples';
import { DemoContext, type Demo } from '@/app/_shared/lib/hooks/useDemo';
import type { AiReport, Audit, Business } from '@/app/_shared/lib/types/auditely';

const business: Business = {
  id: 'b1',
  search_id: 's1',
  name: 'Smile Dental',
  address: '1 Main St',
  website: 'https://smiledental.com',
  phone: null,
  email: 'office@smiledental.com',
  contact_page: null,
  socials: {},
  contacts_checked_at: null,
  email_lookup_at: null,
  rating: null,
  review_count: null,
  created_at: '2026-10-01T00:00:00Z',
};
const audit: Audit = {
  id: 'a1',
  business_id: 'b1',
  performance_score: 42,
  seo_score: 80,
  mobile_score: 38,
  ssl_valid: true,
  geo_score: 25,
  aeo_score: 40,
  lead_score: 30,
  checks: {},
  engine_version: 2,
  raw_json: {},
  created_at: '2026-10-01T00:00:00Z',
};
const report: AiReport = {
  id: 'r1',
  audit_id: 'a1',
  summary: 'Slow site.',
  improvements: ['Compress images'],
  cold_email: 'Hi there,\nYour site is slow.',
  created_at: '2026-10-01T00:00:00Z',
};

// An audited card with its report open, as either tab draws it
const card = (upworkPdf?: boolean) =>
  createElement(BusinessCard, { business, initialAudit: audit, initialReport: report, defaultOpen: true, upworkPdf });
const inDemo = (element: ReactElement) => {
  const demo: Demo = {
    data: {} as DemoData,
    links: demoLinks({}),
    replay: (async () => {
      throw new Error('not used');
    }) as Demo['replay'],
    restrict: () => {},
    playVideo: () => {},
  };
  return createElement(DemoContext.Provider, { value: demo }, element);
};
// A button's opening tag and content, found by its label
const button = (html: string, label: string) => html.split('<button').find((part) => part.includes(`${label}</button>`)) ?? '';

describe('the Upwork PDF button', () => {
  it('sits beside the full report on a card that asks for it (Audit a website)', () => {
    const html = renderToStaticMarkup(card(true));
    expect(button(html, 'Upwork PDF')).not.toBe('');
    expect(button(html, 'Download PDF report')).not.toBe('');
  });

  it('is not offered on any other card (Find leads)', () => {
    const html = renderToStaticMarkup(card());
    expect(html).not.toContain('Upwork PDF');
    expect(button(html, 'Download PDF report')).not.toBe('');
  });

  // The demo's reports are built ahead, in one version
  it('is not offered in the public demo', () => {
    const html = renderToStaticMarkup(inDemo(card(true)));
    expect(html).not.toContain('Upwork PDF');
    expect(button(html, 'Download PDF report')).not.toBe('');
  });
});
