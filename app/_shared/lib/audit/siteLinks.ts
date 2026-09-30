// app/_shared/lib/audit/siteLinks.ts

// A site's own page links, read from one of its pages: they pick the key pages
// the lead-capture checks read, the links those checks test, and the extra
// pages the email finder tries.

import * as cheerio from 'cheerio';
import type { KeyPageKind } from '@/app/_shared/lib/audit/types';

export interface SiteLink {
  url: string;
  /** The link's visible text, whitespace collapsed */
  text: string;
}

export interface KeyPage {
  url: string;
  kind: KeyPageKind;
}

const NOT_A_PAGE = /\.(pdf|jpe?g|png|gif|svg|webp|ico|css|js|zip|docx?|xlsx?|mp[34])$/i;
// Machine endpoints (mostly WordPress) that would eat the page budget
const TECHNICAL_PATH = /\/(feed|wp-json|wp-admin|wp-login\.php|xmlrpc\.php|cdn-cgi|cart|checkout)(\/|$)/i;

/** Booking words; `\bbook` so "facebook" doesn't count, and not "bookkeeping" */
export const BOOKING_WORDS = /\bbook(?!keep)|appointment|schedul|reserv/i;

// For each kind, in this order: the first link whose text or last path segment
// is exactly a name for the page, else the first that mentions one
// ("Contact Us" beats an earlier "Contact Lenses" or "Contact billing").
const KEY_PAGE_RULES: { kind: KeyPageKind; exact: RegExp; loose: RegExp }[] = [
  {
    kind: 'contact',
    exact: /^(contact([\s-]?us)?|get[\s-]in[\s-]touch|reach[\s-]us|visit[\s-]us|enquire|inquire)$/i,
    loose: /contact(?![\s-]?lens)|get[\s-]in[\s-]touch|reach[\s-]us|visit[\s-]us|enquir|inquir/i,
  },
  {
    kind: 'booking',
    exact: /^(book([\s-](now|online|an?[\s-]appointment))?|booking|appointments?|request[\s-]an?[\s-]appointment|schedule([\s-](now|online))?|reservations?)$/i,
    loose: BOOKING_WORDS,
  },
  {
    kind: 'services',
    exact: /^((our[\s-])?services?|treatments?|what[\s-]we[\s-]do|practice[\s-]areas?|programs?)$/i,
    loose: /service|treatment|what[\s-]we[\s-]do|practice[\s-]area|program/i,
  },
  { kind: 'about', exact: /^(about([\s-]us)?|our[\s-]story|who[\s-]we[\s-]are)$/i, loose: /about|our[\s-]story|who[\s-]we[\s-]are/i },
];

/** Same page regardless of scheme, "www." or a trailing slash */
export const pageKey = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();

/** The site a URL belongs to, ignoring "www." */
export const siteHost = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, '');

// "/services/contact-us.html" → "contact-us"
const lastSegment = (url: string) => new URL(url).pathname.split('/').filter(Boolean).pop()?.replace(/\.\w+$/, '') ?? '';

/** The page's <a> links to its own site, in page order, once each; files and technical endpoints skipped. */
export function sameSiteLinks(html: string, pageUrl: string): SiteLink[] {
  const base = new URL(pageUrl);
  const host = siteHost(base);
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const links: SiteLink[] = [];

  $('a[href]').each((_, a) => {
    const href = ($(a).attr('href') ?? '').trim();
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript|sms):/i.test(href)) return;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      return;
    }
    url.hash = '';
    if (!url.protocol.startsWith('http') || siteHost(url) !== host) return;
    if (NOT_A_PAGE.test(url.pathname) || TECHNICAL_PATH.test(url.pathname)) return;
    const key = pageKey(url.href);
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ url: url.href, text: $(a).text().replace(/\s+/g, ' ').trim() });
  });
  return links;
}

/** Up to 4 key pages the homepage links to: its first contact, booking, services and about link. */
export function pickKeyPages(html: string, pageUrl: string): KeyPage[] {
  // The homepage itself, at its own address or at the site root (e.g. reached at /home)
  const homeKeys = new Set([pageKey(pageUrl), pageKey(new URL(pageUrl).origin)]);
  const links = sameSiteLinks(html, pageUrl).filter((link) => !homeKeys.has(pageKey(link.url)));
  const chosen = new Set<string>();
  const pages: KeyPage[] = [];
  for (const { kind, exact, loose } of KEY_PAGE_RULES) {
    const free = links.filter((l) => !chosen.has(l.url));
    const link =
      free.find((l) => exact.test(l.text) || exact.test(lastSegment(l.url))) ??
      free.find((l) => loose.test(`${new URL(l.url).pathname} ${l.text}`));
    if (link) {
      chosen.add(link.url);
      pages.push({ url: link.url, kind });
    }
  }
  return pages;
}
