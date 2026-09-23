// app/_shared/lib/audit/analyzers/seoBasics.ts

// SEO basics read straight from the homepage HTML. Displayed (not scored) —
// the fallback when PageSpeed's SEO category is unavailable.

import type { CheerioAPI } from 'cheerio';
import type { Finding, RobotsTxtStatus, SeoBasics } from '@/app/_shared/lib/audit/types';
import type { RobotsFetch } from '@/app/_shared/lib/audit/siteFetch';

// True when the `User-agent: *` group contains `Disallow: /`
function blocksAll(body: string): boolean {
  let inStarGroup = false;
  let previousWasAgent = false;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'user-agent') {
      // Consecutive User-agent lines share one group
      inStarGroup = previousWasAgent ? inStarGroup || value === '*' : value === '*';
      previousWasAgent = true;
      continue;
    }
    previousWasAgent = false;
    if (inStarGroup && key === 'disallow' && value === '/') return true;
  }
  return false;
}

export function robotsTxtStatus(robots: RobotsFetch): RobotsTxtStatus {
  if (robots.status === 404 || robots.status === 410) return 'missing';
  if (robots.status !== 200 || robots.body === null) return 'unknown';
  return blocksAll(robots.body) ? 'blocks-all' : 'ok';
}

function lengthFinding(id: string, name: string, value: string | null, min: number, max: number): Finding {
  if (!value) return { id, status: 'fail', label: `${name} missing` };
  if (value.length < min || value.length > max) {
    return { id, status: 'warn', label: `${name} is ${value.length} characters (aim for ${min}–${max})` };
  }
  return { id, status: 'pass', label: `${name} present` };
}

function robotsFinding(status: RobotsTxtStatus): Finding {
  switch (status) {
    case 'ok':
      return { id: 'seo.robots', status: 'pass', label: 'robots.txt allows search engines' };
    case 'missing':
      return { id: 'seo.robots', status: 'warn', label: 'No robots.txt file' };
    case 'blocks-all':
      return { id: 'seo.robots', status: 'fail', label: 'robots.txt blocks all search engines' };
    case 'unknown':
      return { id: 'seo.robots', status: 'warn', label: "Couldn't check robots.txt" };
  }
}

export function analyzeSeoBasics($: CheerioAPI, headers: Record<string, string>, robots: RobotsFetch): SeoBasics {
  // Head title first so an inline <svg><title> can't stand in for the page title
  const headTitle = $('head > title').first();
  const title = (headTitle.length > 0 ? headTitle : $('title').first()).text().trim() || null;
  const metaDescription = $('meta[name="description" i]').attr('content')?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;
  const viewport = $('meta[name="viewport" i]').length > 0;
  const metaRobots = $('meta[name="robots" i]').attr('content') ?? '';
  const noindex = /noindex/i.test(metaRobots) || /noindex/i.test(headers['x-robots-tag'] ?? '');
  const robotsTxt = robotsTxtStatus(robots);

  const findings: Finding[] = [
    lengthFinding('seo.title', 'Page title', title, 10, 60),
    lengthFinding('seo.metaDescription', 'Meta description', metaDescription, 50, 160),
    canonical
      ? { id: 'seo.canonical', status: 'pass', label: 'Canonical URL set' }
      : { id: 'seo.canonical', status: 'warn', label: 'No canonical URL' },
    viewport
      ? { id: 'seo.viewport', status: 'pass', label: 'Mobile viewport set' }
      : { id: 'seo.viewport', status: 'fail', label: 'Not set up for mobile (no viewport tag)' },
    noindex
      ? { id: 'seo.noindex', status: 'fail', label: 'Page tells Google not to index it (noindex)' }
      : { id: 'seo.noindex', status: 'pass', label: 'Page can be indexed' },
    robotsFinding(robotsTxt),
  ];

  return { title, metaDescription, canonical, viewport, noindex, robotsTxt, findings };
}
