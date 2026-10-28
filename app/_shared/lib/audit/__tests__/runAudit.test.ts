import { describe, it, expect, vi } from 'vitest';
import { runAudit, AuditUnavailableError, type AuditDeps } from '@/app/_shared/lib/audit/runAudit';
import type { PageSpeedResult, PageSpeedStrategy } from '@/app/_shared/lib/audit/pageSpeed';
import type { SiteFetchResult } from '@/app/_shared/lib/audit/siteFetch';
import type { AuditInput } from '@/app/_shared/lib/audit/types';
import { DENTIST_HOME, JS_SHELL } from '@/app/_shared/lib/audit/__tests__/fixtures';
import { memoryPageSpeedStore } from '@/app/_shared/lib/audit/__tests__/memoryPageSpeedStore';
import type { PageFetchResult } from '@/app/_shared/lib/audit/siteFetch';
import type { LinkResult } from '@/app/_shared/lib/audit/linkCheck';

const psiOk = (perf: number, seo: number | null, isOnHttps: boolean | null = true): PageSpeedResult => ({
  ok: true,
  isOnHttps,
  summary: {
    categories: { performance: { score: perf, title: 'Performance' }, seo: { score: seo, title: 'SEO' } },
    keyAudits: {},
  },
});
const psiFail: PageSpeedResult = { ok: false, reason: 'FAILED_DOCUMENT_REQUEST' };

const siteOk = (html: string, finalUrl = 'https://smiledental.com/'): SiteFetchResult => ({
  ok: true,
  finalUrl,
  status: 200,
  html,
  headers: { 'content-type': 'text/html' },
  robots: { status: 200, body: 'User-agent: *\nDisallow:' },
});
const siteBlocked: SiteFetchResult = {
  ok: false,
  finalUrl: 'https://smiledental.com/',
  status: 403,
  html: null,
  headers: {},
  robots: { status: null, body: null },
  reason: 'Blocked (403)',
};

const input: AuditInput = {
  website: 'http://smiledental.com',
  name: 'Smile Dental',
  address: '123 Main St, Springfield, IL 62701, USA',
  phone: '(555) 123-4567',
  niche: 'dentist',
};

function deps(over: Partial<AuditDeps> = {}): AuditDeps {
  return {
    runPageSpeed: vi.fn(async (_url: string, strategy: PageSpeedStrategy) =>
      strategy === 'mobile' ? psiOk(0.38, 0.71) : psiOk(0.42, 0.7)
    ),
    fetchSite: vi.fn(async () => siteOk(DENTIST_HOME)),
    checkTls: vi.fn(async () => ({ valid: true, daysToExpiry: 60, issuer: "Let's Encrypt" })),
    // Offline by default: key pages 404, every link ok
    fetchPage: vi.fn(async (url: string): Promise<PageFetchResult> => ({ ok: false, status: 404, finalUrl: url, html: null, reason: 'HTTP 404' })),
    checkLinks: vi.fn(async (urls: string[]): Promise<LinkResult[]> => urls.map((url) => ({ url, status: 'ok' }))),
    now: () => 0,
    ...over,
  };
}

describe('runAudit', () => {
  it('maps PageSpeed, TLS and page checks into the audit row', async () => {
    const { row } = await runAudit(input, deps());
    expect(row).toMatchObject({
      performance_score: 42,
      mobile_score: 38,
      seo_score: 71,
      ssl_valid: true,
      geo_score: 100,
      aeo_score: 100,
      engine_version: 2,
    });
    expect(row.checks.psi).toEqual({ mobile: 'ok', desktop: 'ok' });
    expect(row.checks.geo?.nap).toMatchObject({ name: 'match', address: 'match', phone: 'match' });
    expect(row.checks.site).toEqual({ ok: true, finalUrl: 'https://smiledental.com/', status: 200 });
  });

  it('records the tech stack from the page and headers', async () => {
    const wp = { ...siteOk('<meta name="generator" content="WordPress 6.2">' + DENTIST_HOME), headers: { 'content-type': 'text/html', server: 'cloudflare' } };
    const { row } = await runAudit(input, deps({ fetchSite: vi.fn(async () => wp) }));
    expect(row.checks.tech).toEqual([
      { name: 'WordPress', category: 'platform', version: '6.2' },
      { name: 'Cloudflare', category: 'hosting' },
    ]);
  });

  it('still reads hosting from the headers of a blocked site', async () => {
    const blocked = { ...siteBlocked, headers: { 'sg-captcha': 'challenge' } };
    const { row } = await runAudit(input, deps({ fetchSite: vi.fn(async () => blocked) }));
    expect(row.checks.tech).toEqual([{ name: 'SiteGround', category: 'hosting' }]);
  });

  it('stores null scores (not 0) when PageSpeed fails, keeping page checks', async () => {
    const { row } = await runAudit(input, deps({ runPageSpeed: vi.fn(async () => psiFail) }));
    expect(row).toMatchObject({ performance_score: null, mobile_score: null, seo_score: null, geo_score: 100 });
    expect(row.checks.psi).toEqual({ mobile: 'FAILED_DOCUMENT_REQUEST', desktop: 'FAILED_DOCUMENT_REQUEST' });
    expect(row.checks.seo?.title).toContain('Smile Dental');
    expect(row.raw_json).toEqual({ mobile: null, desktop: null });
  });

  it('uses desktop SEO when the mobile run failed', async () => {
    const runPageSpeed = vi.fn(async (_url: string, strategy: PageSpeedStrategy) =>
      strategy === 'mobile' ? psiFail : psiOk(0.42, 0.66)
    );
    const { row } = await runAudit(input, deps({ runPageSpeed }));
    expect(row).toMatchObject({ mobile_score: null, seo_score: 66, performance_score: 42 });
  });

  it('throws AuditUnavailableError when PageSpeed and the site both fail', async () => {
    const failingDeps = deps({ runPageSpeed: vi.fn(async () => psiFail), fetchSite: vi.fn(async () => siteBlocked) });
    await expect(runAudit(input, failingDeps)).rejects.toBeInstanceOf(AuditUnavailableError);
  });

  it('falls back to PageSpeed is-on-https when the TLS handshake fails', async () => {
    const { row } = await runAudit(input, deps({ checkTls: vi.fn(async () => null) }));
    expect(row.ssl_valid).toBe(true);
    expect(row.checks.ssl.error).toBe('TLS handshake could not complete');

    const unknown = await runAudit(
      input,
      deps({ checkTls: vi.fn(async () => null), runPageSpeed: vi.fn(async () => psiFail) })
    );
    expect(unknown.row.ssl_valid).toBeNull();
  });

  it('checks TLS against the final hostname after redirects', async () => {
    const checkTls = vi.fn(async () => ({ valid: true, daysToExpiry: 60, issuer: null }));
    await runAudit(input, deps({ checkTls, fetchSite: vi.fn(async () => siteOk(DENTIST_HOME, 'https://www.smiledental.com/')) }));
    expect(checkTls).toHaveBeenCalledWith('www.smiledental.com');
  });

  it('flags JavaScript-only pages instead of scoring them', async () => {
    const { row } = await runAudit(input, deps({ fetchSite: vi.fn(async () => siteOk(JS_SHELL)) }));
    expect(row.geo_score).toBeNull();
    expect(row.aeo_score).toBeNull();
    expect(row.checks.site.reason).toBe('Content loads via JavaScript — checks limited');
    expect(row.checks.seo?.title).toBe('Loading…');
  });

  it('keeps PageSpeed scores when the site blocks the crawler', async () => {
    const { row } = await runAudit(input, deps({ fetchSite: vi.fn(async () => siteBlocked) }));
    expect(row).toMatchObject({ performance_score: 42, geo_score: null, aeo_score: null });
    expect(row.checks.site.reason).toBe('Blocked (403)');
    expect(row.checks.seo).toBeNull();
  });

  // About the crash, not the speed: the page is parsed several times, and at this depth
  // each parse takes a second or more on a busy machine, past the 5-second default
  it('still returns an audit for pathologically nested HTML', { timeout: 30_000 }, async () => {
    const depth = 5000;
    const text = 'Smile Dental is a family dentist in Springfield offering cleanings and implants. '.repeat(4);
    const html = `<html><head><title>Smile Dental</title></head><body>${'<div>'.repeat(depth)}${text}${'</div>'.repeat(depth)}</body></html>`;
    const { row } = await runAudit(input, deps({ fetchSite: vi.fn(async () => siteOk(html)) }));
    expect(row).toMatchObject({ performance_score: 42, mobile_score: 38 });
    expect(row.checks.site.ok).toBe(true);
  });

  it('passes the homepage HTML to email discovery and survives its failure', async () => {
    const discoverEmail = vi.fn(async () => 'hello@smiledental.com');
    const found = await runAudit({ ...input, discoverEmail }, deps());
    expect(found.email).toBe('hello@smiledental.com');
    expect(discoverEmail).toHaveBeenCalledWith(DENTIST_HOME, []);

    const failing = await runAudit({ ...input, discoverEmail: vi.fn(async () => { throw new Error('boom'); }) }, deps());
    expect(failing.email).toBeNull();
  });

  describe('lead capture', () => {
    // DENTIST_HOME already has a tap-to-call link; add a contact link
    const HOME_WITH_CONTACT = DENTIST_HOME.replace('</footer>', '<a href="/contact">Contact us</a></footer>');
    const CONTACT_PAGE = '<form><input name="name"><textarea name="msg"></textarea></form><p>office@smiledental.com</p>';
    const contactSite = () =>
      deps({
        fetchSite: vi.fn(async () => siteOk(HOME_WITH_CONTACT)),
        fetchPage: vi.fn(async (url: string): Promise<PageFetchResult> => ({ ok: true, status: 200, finalUrl: url, html: CONTACT_PAGE })),
      });

    it('scores the homepage and the key pages it links to', async () => {
      const d = contactSite();
      const { row } = await runAudit(input, d);
      expect(d.fetchPage).toHaveBeenCalledWith('https://smiledental.com/contact');
      // call 25 + form 30 + booking 0 (warn) + contact page 10 + links 20
      expect(row.lead_score).toBe(85);
      expect(row.checks.lead?.pages.map((p) => p.kind)).toEqual(['home', 'contact']);
    });

    it('hands the key pages to email discovery instead of fetching them again', async () => {
      const discoverEmail = vi.fn(async () => null);
      await runAudit({ ...input, discoverEmail }, contactSite());
      expect(discoverEmail).toHaveBeenCalledWith(HOME_WITH_CONTACT, [
        { url: 'https://smiledental.com/contact', html: CONTACT_PAGE },
      ]);
    });

    it('is not measured for a JavaScript-only homepage', async () => {
      const { row } = await runAudit(input, deps({ fetchSite: vi.fn(async () => siteOk(JS_SHELL)) }));
      expect(row.lead_score).toBeNull();
      expect(row.checks.lead).toBeNull();
    });

    it('is not measured when the site blocks the crawler, and fetches no key pages', async () => {
      const d = deps({ fetchSite: vi.fn(async () => siteBlocked) });
      const { row } = await runAudit(input, d);
      expect(row.lead_score).toBeNull();
      expect(d.fetchPage).not.toHaveBeenCalled();
    });

    it('keeps the rest of the audit when fetching the key pages fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const d = contactSite();
      vi.mocked(d.fetchPage).mockRejectedValue(new Error('boom'));
      const { row } = await runAudit(input, d);
      expect(row.lead_score).toBeNull();
      expect(row.performance_score).toBe(42);
      vi.restoreAllMocks();
    });
  });

  describe('with the shared PageSpeed cache', () => {
    const NOW = Date.parse('2026-09-30T12:00:00Z');
    const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
    const cached = (perf: number, fetchedAt: string) => {
      const result = psiOk(perf, 0.8);
      return { summary: result.ok ? result.summary : null!, isOnHttps: true, engineVersion: 2, fetchedAt };
    };
    // Stored by an audit of another listing with the same website
    const store = () =>
      memoryPageSpeedStore({
        'smiledental.com|mobile': cached(0.5, daysAgo(10)),
        'smiledental.com|desktop': cached(0.6, daysAgo(20)),
      }).store;

    it('reuses the stored results and records when they were measured', async () => {
      const d = deps({ pageSpeedStore: store(), now: () => NOW });
      const { row } = await runAudit(input, d);
      expect(d.runPageSpeed).not.toHaveBeenCalled();
      expect(row).toMatchObject({ mobile_score: 50, performance_score: 60, seo_score: 80 });
      expect(row.checks.psi).toEqual({ mobile: 'ok', desktop: 'ok', measuredAt: daysAgo(20) });
    });

    it('runs PageSpeed afresh for a Re-audit', async () => {
      const d = deps({ pageSpeedStore: store(), now: () => NOW });
      const { row } = await runAudit({ ...input, refreshPageSpeed: true }, d);
      expect(d.runPageSpeed).toHaveBeenCalledTimes(2);
      expect(row).toMatchObject({ mobile_score: 38, performance_score: 42 });
      expect(row.checks.psi).toEqual({ mobile: 'ok', desktop: 'ok' });
    });
  });
});
