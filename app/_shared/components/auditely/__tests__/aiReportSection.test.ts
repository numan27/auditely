import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiReportSection } from '@/app/_shared/components/auditely/aiReportSection/aiReportSection';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';
import type { AiReport } from '@/app/_shared/lib/types/auditely';

const report = {
  id: 'r1',
  audit_id: 'a1',
  summary: 'Your site is slow on phones.',
  improvements: ['Compress the images.'],
  cold_email: 'Subject: Hi\n\nYour site is slow.\n\nSam, Acme',
  created_at: '2026-10-02T00:00:00Z',
} as AiReport;
const audit: AuditLike = { created_at: '2026-10-01T00:00:00Z', performance_score: 40, seo_score: 90, mobile_score: 50, ssl_valid: true, checks: null, raw_json: null };
const render = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(AiReportSection, { report, businessName: 'Smile Dental', audit, emailedAt: null, ...props }));

describe('AiReportSection', () => {
  it('offers Write again only when the panel passes it (never in the demo)', () => {
    expect(render()).not.toContain('Write again');
    expect(render({ onRewrite: () => {} })).toContain('Write again');
  });

  it('shows Writing… on a disabled button while it works, and keeps the old summary', () => {
    const html = render({ onRewrite: () => {}, rewriting: true });
    expect(html).toContain('Writing…');
    expect(html).not.toContain('Write again');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>(?:(?!<\/button>).)*Writing…/);
    expect(html).toContain('Your site is slow on phones.');
  });

  it('says why it couldn’t, under the summary', () => {
    const html = render({ onRewrite: () => {}, rewriteError: 'You can write a summary again 10 times an hour. Try again later.' });
    expect(html.indexOf('You can write a summary again')).toBeGreaterThan(html.indexOf('Your site is slow on phones.'));
    expect(html.indexOf('You can write a summary again')).toBeLessThan(html.indexOf('What to fix first'));
  });

  // A website that passed: nothing to list, and nothing to pitch
  describe('for a website with nothing to fix', () => {
    const clean = { ...report, summary: 'The site did well.', improvements: [], cold_email: 'Subject: No issues found\n\nAll good.\n\nSam, Acme' } as AiReport;

    it('leaves out What to fix first', () => {
      const html = render({ report: clean });
      expect(html).toContain('The site did well.');
      expect(html).not.toContain('What to fix first');
    });

    it('drafts no outreach email, and says why', () => {
      const html = render({ report: clean });
      expect(html).not.toContain('No issues found');
      expect(html).not.toContain('Copy email');
      expect(html).toContain('No email for this one. We found no problems on the website to write to Smile Dental about.');
    });

    it('still drafts the reply to someone who asked for the audit', () => {
      const request = { source_id: 'q1', name: 'Sarah', business_type: 'Dentist', main_concern: null, requested_at: '2026-10-01T00:00:00Z' };
      const html = render({ report: clean, request });
      expect(html).toContain('Reply email');
      expect(html).toContain('Copy email');
    });

    it('keeps the drafts for a lead already emailed', () => {
      const html = render({ report: clean, emailedAt: '2026-10-20T00:00:00Z' });
      expect(html).toContain('Follow-up email');
      expect(html).not.toContain('No email for this one');
    });
  });
});
