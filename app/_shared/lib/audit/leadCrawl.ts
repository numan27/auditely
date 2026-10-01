// app/_shared/lib/audit/leadCrawl.ts

// Fetches the key pages the lead-capture checks read and lists the links to
// test. The key pages are also handed to the email finder, so no page is
// downloaded twice.

import { pageKey, pickKeyPages, sameSiteLinks, siteHost } from '@/app/_shared/lib/audit/siteLinks';
import { linkStatus, MAX_LINKS, type LinkResult } from '@/app/_shared/lib/audit/linkCheck';
import type { fetchPage } from '@/app/_shared/lib/audit/siteFetch';
import type { LeadPage } from '@/app/_shared/lib/audit/analyzers/leadCapture';

export interface CrawledPage extends LeadPage {
  /** HTTP status; null when the page couldn't be reached */
  status: number | null;
}

/** The homepage, then up to 4 key pages it links to, fetched in parallel. */
export async function crawlKeyPages(homeUrl: string, homeHtml: string, load: typeof fetchPage): Promise<CrawledPage[]> {
  const keyPages = await Promise.all(
    pickKeyPages(homeHtml, homeUrl).map(async ({ url, kind }): Promise<CrawledPage> => {
      const page = await load(url);
      return { url, finalUrl: page.finalUrl ?? url, kind, html: page.ok ? page.html : null, status: page.status };
    })
  );
  return [{ url: homeUrl, finalUrl: homeUrl, kind: 'home', html: homeHtml, status: 200 }, ...keyPages];
}

/**
 * Same-site links on the loaded pages that weren't fetched already, homepage
 * links first; at most 30. A page's links resolve against where it ended up,
 * and a key page that redirected to another site (a booking tool) has none.
 */
export function linkTargets(pages: CrawledPage[]): string[] {
  const host = siteHost(new URL(pages[0].url));
  const seen = new Set(pages.flatMap((p) => [p.url, p.finalUrl ?? p.url]).map(pageKey));
  const targets: string[] = [];
  for (const page of pages) {
    const base = page.finalUrl ?? page.url;
    if (page.html === null || siteHost(new URL(base)) !== host) continue;
    for (const { url } of sameSiteLinks(page.html, base)) {
      if (seen.has(pageKey(url))) continue;
      seen.add(pageKey(url));
      targets.push(url);
    }
  }
  return targets.slice(0, MAX_LINKS);
}

/** Key pages were requested already: their status counts as a link check. */
export function keyPageLinks(pages: CrawledPage[]): LinkResult[] {
  return pages.filter((p) => p.kind !== 'home').map((p) => ({ url: p.url, status: linkStatus(p.status) }));
}
