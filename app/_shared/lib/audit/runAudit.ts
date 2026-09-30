// app/_shared/lib/audit/runAudit.ts

// Audit orchestrator: PageSpeed (mobile + desktop), one homepage fetch, a TLS
// handshake and email discovery run concurrently; pure analyzers read the HTML.
// Server-only (imports node:tls via tlsCheck).

import * as cheerio from 'cheerio';
import { runPageSpeed, categoryScore, type PageSpeedResult } from '@/app/_shared/lib/audit/pageSpeed';
import { withPageSpeedCache, type PageSpeedStore } from '@/app/_shared/lib/audit/pageSpeedCache';
import { fetchSite, fetchPage, type SiteFetchResult } from '@/app/_shared/lib/audit/siteFetch';
import { checkLinks, type LinkResult } from '@/app/_shared/lib/audit/linkCheck';
import { crawlKeyPages, keyPageLinks, linkTargets, type CrawledPage } from '@/app/_shared/lib/audit/leadCrawl';
import { analyzeLeadCapture } from '@/app/_shared/lib/audit/analyzers/leadCapture';
import { checkTls } from '@/app/_shared/lib/audit/tlsCheck';
import { parseStructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';
import { compareNap, extractNapSignals } from '@/app/_shared/lib/audit/analyzers/nap';
import { analyzeGeo } from '@/app/_shared/lib/audit/analyzers/geo';
import { analyzeAeo } from '@/app/_shared/lib/audit/analyzers/aeo';
import { analyzeSeoBasics } from '@/app/_shared/lib/audit/analyzers/seoBasics';
import { detectTechStack } from '@/app/_shared/lib/audit/analyzers/techStack';
import { visibleText } from '@/app/_shared/lib/audit/analyzers/text';
import {
  CURRENT_ENGINE_VERSION,
  type AeoChecks,
  type AuditInput,
  type AuditOutcome,
  type GeoChecks,
  type LeadChecks,
  type SeoBasics,
  type SslCheck,
  type TechItem,
} from '@/app/_shared/lib/audit/types';

const PSI_DEADLINE_MS = 240_000;
const MIN_VISIBLE_TEXT = 200;
const JS_ONLY_REASON = 'Content loads via JavaScript — checks limited';
const ANALYSIS_FAILED_REASON = "Couldn't analyze page content";

/** Neither PageSpeed nor the site itself could be read — nothing worth storing. */
export class AuditUnavailableError extends Error {}

export interface AuditDeps {
  runPageSpeed: typeof runPageSpeed;
  fetchSite: typeof fetchSite;
  fetchPage: typeof fetchPage;
  checkTls: typeof checkTls;
  checkLinks: typeof checkLinks;
  now: () => number;
  /** Shared 30-day PageSpeed cache; without one PageSpeed always runs */
  pageSpeedStore?: PageSpeedStore;
}

const defaultDeps: AuditDeps = { runPageSpeed, fetchSite, fetchPage, checkTls, checkLinks, now: () => Date.now() };

interface PageAnalysis {
  seo: SeoBasics;
  geo: { score: number; checks: GeoChecks } | null;
  aeo: { score: number; checks: AeoChecks } | null;
  limitedReason: string | null;
}

function analyzePage(html: string, site: SiteFetchResult, input: AuditInput): PageAnalysis {
  const $ = cheerio.load(html);
  const seo = analyzeSeoBasics($, site.headers, site.robots);
  const text = visibleText($);
  if (text.length < MIN_VISIBLE_TEXT) return { seo, geo: null, aeo: null, limitedReason: JS_ONLY_REASON };

  const structured = parseStructuredData($, input.name, input.phone);
  const nap = compareNap(
    { name: input.name, address: input.address, phone: input.phone },
    extractNapSignals($, structured.entity, text)
  );
  return {
    seo,
    geo: analyzeGeo(structured, nap, input.niche),
    aeo: analyzeAeo($, structured),
    limitedReason: null,
  };
}

// TLS handshake wins; otherwise PageSpeed's is-on-https; otherwise unknown (null)
function resolveSsl(tls: SslCheck | null, psi: PageSpeedResult[]): SslCheck {
  if (tls) return tls;
  const fromPsi = psi.find((r) => r.ok && r.isOnHttps !== null);
  return {
    valid: fromPsi && fromPsi.ok ? fromPsi.isOnHttps : null,
    daysToExpiry: null,
    issuer: null,
    error: 'TLS handshake could not complete',
  };
}

// Key pages that loaded, for the email finder
const loadedKeyPages = (pages: CrawledPage[] | null) =>
  (pages ?? []).flatMap((p) => (p.kind !== 'home' && p.html !== null ? [{ url: p.url, html: p.html }] : []));

// Oldest measurement among PageSpeed results reused from the cache, if any
function reusedMeasuredAt(psi: PageSpeedResult[]): string | undefined {
  const times = psi.flatMap((r) => (r.ok && r.measuredAt ? [Date.parse(r.measuredAt)] : []));
  return times.length ? new Date(Math.min(...times)).toISOString() : undefined;
}

export async function runAudit(input: AuditInput, overrides: Partial<AuditDeps> = {}): Promise<AuditOutcome> {
  const deps: AuditDeps = { ...defaultDeps, ...overrides };
  const pageSpeed = deps.pageSpeedStore
    ? withPageSpeedCache(deps.runPageSpeed, deps.pageSpeedStore, { refresh: input.refreshPageSpeed, now: deps.now })
    : deps.runPageSpeed;
  let listedHost: string;
  try {
    listedHost = new URL(input.website).hostname;
  } catch {
    throw new AuditUnavailableError('Invalid website URL');
  }

  const deadline = deps.now() + PSI_DEADLINE_MS;
  const sitePromise = deps.fetchSite(input.website);
  const finalHost = (site: SiteFetchResult) => (site.finalUrl ? new URL(site.finalUrl).hostname : listedHost);

  // Lead capture: the key pages the homepage links to, then a check of the
  // site's links — all while PageSpeed runs. Email discovery reuses the pages.
  const crawlPromise: Promise<CrawledPage[] | null> = sitePromise
    .then((s) => (s.ok && s.html !== null ? crawlKeyPages(s.finalUrl ?? input.website, s.html, deps.fetchPage) : null))
    .catch((err) => {
      console.warn('[audit] key page crawl failed:', err);
      return null;
    });
  const linksPromise: Promise<LinkResult[]> = crawlPromise.then(async (pages) =>
    pages ? [...keyPageLinks(pages), ...(await deps.checkLinks(linkTargets(pages)))] : []
  );

  const [mobile, desktop, site, tls, email, crawl, links] = await Promise.all([
    pageSpeed(input.website, 'mobile', deadline),
    pageSpeed(input.website, 'desktop', deadline),
    sitePromise,
    sitePromise
      .then((s) => deps.checkTls(finalHost(s)))
      .catch((err) => {
        console.warn('[audit] TLS check failed:', err);
        return null;
      }),
    Promise.all([sitePromise, crawlPromise])
      .then(([s, pages]) => (input.discoverEmail ? input.discoverEmail(s.ok ? s.html : null, loadedKeyPages(pages)) : null))
      .catch((err) => {
        console.warn('[audit] email discovery failed:', err);
        return null;
      }),
    crawlPromise,
    linksPromise,
  ]);

  if (!mobile.ok && !desktop.ok && !site.ok) {
    throw new AuditUnavailableError(site.reason ?? mobile.reason);
  }

  // An analyzer crash must not lose the PageSpeed/TLS results — keep them, skip the page checks
  let page: PageAnalysis | null = null;
  let analysisReason: string | undefined;
  if (site.ok && site.html !== null) {
    try {
      page = analyzePage(site.html, site, input);
    } catch (err) {
      console.error('[audit] page analysis failed:', err);
      analysisReason = ANALYSIS_FAILED_REASON;
    }
  }
  // Same "not measured" rule as GEO/AEO: a readable, non-JavaScript-only homepage
  let lead: { score: number; checks: LeadChecks } | null = null;
  if (crawl && page && !page.limitedReason) {
    try {
      lead = analyzeLeadCapture(crawl, links);
    } catch (err) {
      console.error('[audit] lead capture analysis failed:', err);
    }
  }

  const mobileSummary = mobile.ok ? mobile.summary : null;
  const desktopSummary = desktop.ok ? desktop.summary : null;
  const ssl = resolveSsl(tls, [mobile, desktop]);
  const measuredAt = reusedMeasuredAt([mobile, desktop]);
  const siteReason = site.reason ?? analysisReason ?? page?.limitedReason ?? undefined;
  // Outside analyzePage: a blocked site's headers still reveal its hosting
  let tech: TechItem[] = [];
  try {
    tech = detectTechStack(site.ok ? site.html : null, site.headers);
  } catch (err) {
    console.error('[audit] tech stack detection failed:', err);
  }

  return {
    email,
    row: {
      performance_score: categoryScore(desktopSummary, 'performance'),
      mobile_score: categoryScore(mobileSummary, 'performance'),
      seo_score: categoryScore(mobileSummary, 'seo') ?? categoryScore(desktopSummary, 'seo'),
      ssl_valid: ssl.valid,
      geo_score: page?.geo?.score ?? null,
      aeo_score: page?.aeo?.score ?? null,
      lead_score: lead?.score ?? null,
      checks: {
        ssl,
        seo: page?.seo ?? null,
        geo: page?.geo?.checks ?? null,
        aeo: page?.aeo?.checks ?? null,
        lead: lead?.checks ?? null,
        site: {
          ok: site.ok,
          finalUrl: site.finalUrl,
          status: site.status,
          ...(siteReason ? { reason: siteReason } : {}),
        },
        psi: {
          mobile: mobile.ok ? 'ok' : mobile.reason,
          desktop: desktop.ok ? 'ok' : desktop.reason,
          ...(measuredAt ? { measuredAt } : {}),
        },
        tech,
      },
      raw_json: { mobile: mobileSummary, desktop: desktopSummary },
      engine_version: CURRENT_ENGINE_VERSION,
    },
  };
}
