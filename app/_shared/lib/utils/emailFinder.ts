// app/_shared/lib/utils/emailFinder.ts

// Finds a business's email on its website: the homepage, the usual contact /
// about pages, then up to 8 more of the site's own pages. The paid provider
// lookups (Hunter, Snov…) live in emailApis.ts.

import { FREE_MAIL_DOMAINS, isValidBusinessEmail } from '@/app/_shared/lib/utils/emailValidation';
import { lookupEmailViaApis } from '@/app/_shared/lib/utils/emailApis';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAILTO_REGEX = /href=["']mailto:([^"'?\s]+)/gi;
const CF_EMAIL_REGEX = /data-cfemail=["']([a-f0-9]+)["']/gi;
// "info at acme dot com" — bare words only count as a full address with at least
// one " dot ", so prose like "Order online at doordash.com" is never matched.
const BARE_WORD_EMAIL_REGEX = /\b([A-Z0-9._%+-]+)\s+at\s+([A-Z0-9-]+(?:\s+dot\s+[A-Z0-9-]+)+)\b/gi;

const PAGES_TO_TRY = [
  '/contact', '/contact-us', '/about', '/about-us',
  '/team', '/staff', '/support', '/impressum',
];

// Extra same-site pages to read when the usual ones have no email, likely ones first
const MAX_EXTRA_PAGES = 8;
const LIKELY_EMAIL_PAGE = /contact|about|team|staff|doctor|provider|privacy|new-patient|patient|location|office/i;
// Careers pages mostly list HR inboxes, not sales contacts — read them last
const HR_PAGE = /career|job|employment|hiring|recruit/i;
const NOT_A_PAGE = /\.(pdf|jpe?g|png|gif|svg|webp|ico|css|js|zip|docx?|xlsx?|mp[34])$/i;
// Machine endpoints (mostly WordPress) that would eat the page budget
const TECHNICAL_PATH = /\/(feed|wp-json|wp-admin|wp-login\.php|xmlrpc\.php|cdn-cgi|cart|checkout)(\/|$)/i;

const GENERIC_PREFIXES = new Set([
  'info', 'contact', 'hello', 'support', 'admin', 'sales', 'office',
  'mail', 'email', 'help', 'inquiries', 'enquiries', 'service', 'team',
]);

// Cloudflare email obfuscation: first 2 hex chars are XOR key, each pair after is XOR'd character
function decodeCfEmail(encoded: string): string | null {
  try {
    const key = parseInt(encoded.substring(0, 2), 16);
    let email = '';
    for (let i = 2; i < encoded.length; i += 2) {
      email += String.fromCharCode(parseInt(encoded.substring(i, i + 2), 16) ^ key);
    }
    return email.includes('@') ? email : null;
  } catch {
    return null;
  }
}

// Normalize human-readable obfuscations into real addresses:
//   "info [at] acme [dot] com" / "info (at) acme (dot) com" → "info@acme.com"
//   "info at acme dot com" → "info@acme.com" (full pattern only, see BARE_WORD_EMAIL_REGEX)
function deobfuscate(text: string): string {
  return text
    .replace(/\s*[[({]\s*at\s*[)\]}]\s*/gi, '@')
    .replace(/\s*[[({]\s*dot\s*[)\]}]\s*/gi, '.')
    .replace(BARE_WORD_EMAIL_REGEX, (_match, local: string, rest: string) =>
      `${local}@${rest.replace(/\s+dot\s+/gi, '.')}`
    );
}

function extractEmails(html: string): string[] {
  const found = new Set<string>();

  // 1. mailto: links — highest signal
  let match: RegExpExecArray | null;
  MAILTO_REGEX.lastIndex = 0;
  while ((match = MAILTO_REGEX.exec(html)) !== null) {
    try {
      const email = decodeURIComponent(match[1]).toLowerCase();
      if (isValidBusinessEmail(email)) found.add(email);
    } catch { /* malformed mailto */ }
  }

  // 2. Cloudflare-obfuscated emails
  CF_EMAIL_REGEX.lastIndex = 0;
  while ((match = CF_EMAIL_REGEX.exec(html)) !== null) {
    const decoded = decodeCfEmail(match[1]);
    if (decoded && isValidBusinessEmail(decoded)) found.add(decoded.toLowerCase());
  }

  // 3. Plain-text emails (strip scripts/styles first, then deobfuscate human patterns)
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  const deobfuscated = deobfuscate(cleaned);
  EMAIL_REGEX.lastIndex = 0;
  while ((match = EMAIL_REGEX.exec(deobfuscated)) !== null) {
    const email = match[0].toLowerCase();
    if (isValidBusinessEmail(email)) found.add(email);
  }

  return Array.from(found);
}

function pickBestEmail(emails: string[], targetDomain: string): string | null {
  if (emails.length === 0) return null;

  const cleanDomain = targetDomain.replace(/^www\./, '').toLowerCase();

  // Prefer emails on the same domain (most trustworthy); otherwise only
  // accept free-mail inboxes, never another company's address.
  const onDomain = emails.filter((e) => {
    const d = e.split('@')[1];
    return d === cleanDomain || d.endsWith(`.${cleanDomain}`);
  });
  const candidates = onDomain.length > 0
    ? onDomain
    : emails.filter((e) => FREE_MAIL_DOMAINS.has(e.split('@')[1]));
  if (candidates.length === 0) return null;

  // Prefer personal-looking local parts over generic ones (info@, contact@)
  const personal = candidates.filter((e) => !GENERIC_PREFIXES.has(e.split('@')[0]));

  return personal[0] ?? candidates[0];
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Auditely/1.0)' },
      redirect: 'follow',
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

// Same page regardless of scheme, "www." or a trailing slash
const pageKey = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();

/** The site's own page links (<a> only) from its homepage, likely contact/about/team pages first. */
function siteLinks(html: string, website: string, alreadyRead: Set<string>): string[] {
  const base = new URL(website);
  const host = base.hostname.replace(/^www\./, '');
  const seen = new Set(alreadyRead);
  const links: string[] = [];
  for (const [, href] of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)/gi)) {
    if (/^(mailto|tel|javascript|sms):/i.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (!url.protocol.startsWith('http') || url.hostname.replace(/^www\./, '') !== host) continue;
    if (NOT_A_PAGE.test(url.pathname) || TECHNICAL_PATH.test(url.pathname) || seen.has(pageKey(url.href))) continue;
    seen.add(pageKey(url.href));
    links.push(url.href);
  }
  // Stable sort: likely pages first, then the rest in page order, careers pages last
  const rank = (link: string) => (HR_PAGE.test(link) ? 2 : LIKELY_EMAIL_PAGE.test(link) ? 0 : 1);
  return links.sort((a, b) => rank(a) - rank(b));
}

async function emailsFrom(urls: string[]): Promise<string[]> {
  const pages = await Promise.all(urls.map(fetchPage));
  return pages.flatMap((html) => (html ? extractEmails(html) : []));
}

async function scrapeWebsite(website: string, homepageHtml?: string | null): Promise<string | null> {
  const url = new URL(website);
  const domain = url.hostname;

  // Homepage first (reusing HTML the audit already fetched) — if it has a good email, we're done
  const homepage = homepageHtml ?? (await fetchPage(website));
  const found = new Set<string>(homepage ? extractEmails(homepage) : []);
  const homepageBest = pickBestEmail([...found], domain);
  if (homepageBest) return homepageBest;

  // Then the usual contact/about pages, concurrently
  const usualPages = PAGES_TO_TRY.map((p) => `${url.origin}${p}`);
  (await emailsFrom(usualPages)).forEach((e) => found.add(e));
  const usualBest = pickBestEmail([...found], domain);
  if (usualBest || !homepage) return usualBest;

  // Last, a few more of the site's own pages (privacy, new patients, careers…)
  const alreadyRead = new Set([website, ...usualPages].map(pageKey));
  const extraPages = siteLinks(homepage, website, alreadyRead).slice(0, MAX_EXTRA_PAGES);
  (await emailsFrom(extraPages)).forEach((e) => found.add(e));
  return pickBestEmail([...found], domain);
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function findEmail(
  website: string,
  opts: { apiFallback?: boolean; homepageHtml?: string | null } = {}
): Promise<string | null> {
  let domain: string;
  try {
    domain = new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }

  // 1. Scrape the website (free, fastest, highest trust)
  const scraped = await scrapeWebsite(website, opts.homepageHtml);
  if (scraped) return scraped;

  // 2. The paid APIs only when asked: the manual "Find email" action runs the
  //    full cascade. (The automatic after-search pass calls lookupEmailViaApis
  //    in 'auto' mode directly — see /api/find-emails.)
  if (!opts.apiFallback) return null;
  return lookupEmailViaApis(domain, 'all');
}
