// app/_shared/lib/audit/runAudit.ts

// Audit orchestrator: PageSpeed (mobile + desktop), one homepage fetch, a TLS
// handshake and email discovery run concurrently; pure analyzers read the HTML.
// Server-only (imports node:tls via tlsCheck).

import * as cheerio from 'cheerio';
import { runPageSpeed, categoryScore, type PageSpeedResult } from '@/app/_shared/lib/audit/pageSpeed';
import { fetchSite, type SiteFetchResult } from '@/app/_shared/lib/audit/siteFetch';
import { checkTls } from '@/app/_shared/lib/audit/tlsCheck';
import { parseStructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';
import { compareNap, extractNapSignals } from '@/app/_shared/lib/audit/analyzers/nap';
import { analyzeGeo } from '@/app/_shared/lib/audit/analyzers/geo';
import { analyzeAeo } from '@/app/_shared/lib/audit/analyzers/aeo';
import { analyzeSeoBasics } from '@/app/_shared/lib/audit/analyzers/seoBasics';
import { visibleText } from '@/app/_shared/lib/audit/analyzers/text';
import {
  CURRENT_ENGINE_VERSION,
  type AeoChecks,
  type AuditInput,
  type AuditOutcome,
  type GeoChecks,
  type SeoBasics,
  type SslCheck,
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
  checkTls: typeof checkTls;
  now: () => number;
}

const defaultDeps: AuditDeps = { runPageSpeed, fetchSite, checkTls, now: () => Date.now() };

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

export async function runAudit(input: AuditInput, deps: AuditDeps = defaultDeps): Promise<AuditOutcome> {
  let listedHost: string;
  try {
    listedHost = new URL(input.website).hostname;
  } catch {
    throw new AuditUnavailableError('Invalid website URL');
  }

  const deadline = deps.now() + PSI_DEADLINE_MS;
  const sitePromise = deps.fetchSite(input.website);
  const finalHost = (site: SiteFetchResult) => (site.finalUrl ? new URL(site.finalUrl).hostname : listedHost);

  const [mobile, desktop, site, tls, email] = await Promise.all([
    deps.runPageSpeed(input.website, 'mobile', deadline),
    deps.runPageSpeed(input.website, 'desktop', deadline),
    sitePromise,
    sitePromise
      .then((s) => deps.checkTls(finalHost(s)))
      .catch((err) => {
        console.warn('[audit] TLS check failed:', err);
        return null;
      }),
    sitePromise
      .then((s) => (input.discoverEmail ? input.discoverEmail(s.ok ? s.html : null) : null))
      .catch((err) => {
        console.warn('[audit] email discovery failed:', err);
        return null;
      }),
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
  const mobileSummary = mobile.ok ? mobile.summary : null;
  const desktopSummary = desktop.ok ? desktop.summary : null;
  const ssl = resolveSsl(tls, [mobile, desktop]);
  const siteReason = site.reason ?? analysisReason ?? page?.limitedReason ?? undefined;

  return {
    email,
    row: {
      performance_score: categoryScore(desktopSummary, 'performance'),
      mobile_score: categoryScore(mobileSummary, 'performance'),
      seo_score: categoryScore(mobileSummary, 'seo') ?? categoryScore(desktopSummary, 'seo'),
      ssl_valid: ssl.valid,
      geo_score: page?.geo?.score ?? null,
      aeo_score: page?.aeo?.score ?? null,
      checks: {
        ssl,
        seo: page?.seo ?? null,
        geo: page?.geo?.checks ?? null,
        aeo: page?.aeo?.checks ?? null,
        site: {
          ok: site.ok,
          finalUrl: site.finalUrl,
          status: site.status,
          ...(siteReason ? { reason: siteReason } : {}),
        },
        psi: { mobile: mobile.ok ? 'ok' : mobile.reason, desktop: desktop.ok ? 'ok' : desktop.reason },
      },
      raw_json: { mobile: mobileSummary, desktop: desktopSummary },
      engine_version: CURRENT_ENGINE_VERSION,
    },
  };
}
