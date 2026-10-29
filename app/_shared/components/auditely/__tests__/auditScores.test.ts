import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuditScores } from '@/app/_shared/components/auditely/auditScores/auditScores';
import { AuditChecklist } from '@/app/_shared/components/auditely/auditChecklist/auditChecklist';
import type { AuditFields } from '@/app/_shared/lib/types/auditely';

// A site whose bot protection turned the audit away: Google's scores came back, ours didn't
const unread = (reason: string) =>
  ({
    performance_score: 57, seo_score: 100, mobile_score: 33, ssl_valid: true,
    geo_score: null, aeo_score: null, lead_score: null,
    raw_json: { mobile: { keyAudits: { cls: { title: 'Cumulative Layout Shift', score: 0.1, displayValue: '1.171' } } } },
    checks: { site: { ok: false, finalUrl: null, status: 403, reason }, psi: { mobile: 'ok', desktop: 'ok' } },
  }) as unknown as AuditFields;
const scores = (audit: AuditFields) => renderToStaticMarkup(createElement(AuditScores, { audit }));

describe('AuditScores for a site that couldn’t be read', () => {
  it('says the website blocked the checks, right under the scores', () => {
    const html = scores(unread('Blocked (403)'));
    expect(html).toContain('This website blocked our checks');
    expect(html).toContain(
      "It turns away automated visitors, so GEO, AEO and lead capture couldn&#x27;t be checked. Performance, SEO, mobile and SSL come from Google and aren&#x27;t affected."
    );
    expect(html.indexOf('This website blocked our checks')).toBeLessThan(html.indexOf('Biggest issues on mobile'));
  });

  it('marks the GEO, AEO and lead capture tiles Blocked', () => {
    expect(scores(unread('Blocked (bot challenge)')).match(/>Blocked</g)).toHaveLength(3);
  });

  it('says why for a site that didn’t answer, without calling it blocked', () => {
    const html = scores(unread('Site timed out'));
    expect(html).toContain('We couldn&#x27;t read this website');
    expect(html).toContain('It took too long to answer, so GEO, AEO and lead capture couldn&#x27;t be checked.');
    expect(html).not.toContain('>Blocked<');
  });

  it('shows no notice for a site that was read', () => {
    const audit = { ...unread('Blocked (403)'), geo_score: 80, aeo_score: 70, lead_score: 60, checks: { psi: { mobile: 'ok', desktop: 'ok' } } } as unknown as AuditFields;
    const html = scores(audit);
    expect(html).not.toContain('blocked our checks');
    expect(html).not.toContain('>Blocked<');
  });

  it('leaves the checklist empty, so the notice isn’t said twice', () => {
    expect(renderToStaticMarkup(createElement(AuditChecklist, { audit: unread('Blocked (403)') }))).toBe('');
  });
});
