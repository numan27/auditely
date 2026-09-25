// app/_shared/lib/utils/contactChannels.ts

// Other ways to reach a business, read from its homepage: the phone (tap-to-call
// link or schema.org telephone), the contact page, and the social profiles its
// header/footer icons or schema.org sameAs point to.

import * as cheerio from 'cheerio';
import { parseStructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';
import { formatPhone, phoneDigits } from '@/app/_shared/lib/audit/analyzers/text';

export interface Socials {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
}

export interface ContactChannels {
  phone: string | null;
  contactPage: string | null;
  socials: Socials;
}

interface Network {
  key: keyof Socials;
  host: RegExp;
  /** Returns the canonical profile path, or null for share buttons, posts, pixels… */
  profilePath: (url: URL) => string | null;
}

// Site-builder and placeholder accounts that templates link to by default
const GENERIC_ACCOUNTS = new Set(['wix', 'godaddy', 'squarespace', 'wordpress', 'weebly', 'shopify', 'facebook', 'instagram', 'linkedin']);

const firstSegment = (url: URL): string | null => url.pathname.split('/').filter(Boolean)[0] ?? null;

const NETWORKS: Network[] = [
  {
    key: 'facebook',
    host: /(^|\.)(facebook|fb)\.com$/,
    profilePath: (url) => {
      if (url.pathname.replace(/\/$/, '') === '/profile.php') {
        const id = url.searchParams.get('id');
        return id ? `/profile.php?id=${id}` : null;
      }
      const first = firstSegment(url);
      if (!first || /^(sharer|share|dialog|plugins|tr|login|help|policies|privacy|watch|hashtag)(\.php)?$/i.test(first)) {
        return null;
      }
      return url.pathname.replace(/\/+$/, '');
    },
  },
  {
    key: 'instagram',
    host: /(^|\.)instagram\.com$/,
    profilePath: (url) => {
      const first = firstSegment(url);
      return first && !/^(p|reel|reels|explore|accounts|stories|tv)$/i.test(first) ? `/${first}` : null;
    },
  },
  {
    key: 'linkedin',
    host: /(^|\.)linkedin\.com$/,
    profilePath: (url) => {
      const [kind, name] = url.pathname.split('/').filter(Boolean);
      return kind && name && /^(company|in|school)$/i.test(kind) ? `/${kind}/${name}` : null;
    },
  },
];

function toSocial(href: string): [keyof Socials, string] | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const network = NETWORKS.find((n) => n.host.test(url.hostname.toLowerCase()));
  const path = network?.profilePath(url);
  if (!network || !path) return null;
  const account = path.split(/[/?]/).filter(Boolean)[0]?.toLowerCase();
  if (!account || GENERIC_ACCOUNTS.has(account)) return null;
  return [network.key, `https://www.${network.key}.com${path}`];
}

const formatUsPhone = (raw: string | null | undefined): string | null => {
  const digits = raw ? phoneDigits(raw) : null;
  return digits ? formatPhone(digits) : null;
};

const siteHost = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, '');

export function extractContactChannels(html: string, pageUrl: string): ContactChannels {
  const $ = cheerio.load(html);
  const page = new URL(pageUrl);
  const entity = parseStructuredData($, null).entity;
  const links = $('a[href]')
    .map((_, a) => ({ href: ($(a).attr('href') ?? '').trim(), text: $(a).text().trim() }))
    .get();

  // Links in page order first, then schema.org sameAs; the first profile per network wins
  const socials: Socials = {};
  for (const href of [...links.map((link) => link.href), ...(entity?.sameAs ?? [])]) {
    const social = toSocial(href);
    if (social && !socials[social[0]]) socials[social[0]] = social[1];
  }

  const tel = links.find((link) => /^tel:/i.test(link.href));
  const phone = formatUsPhone(tel?.href.slice(4)) ?? formatUsPhone(entity?.telephone);

  let contactPage: string | null = null;
  for (const link of links) {
    if (/^(mailto|tel|javascript|sms):/i.test(link.href)) continue;
    let url: URL;
    try {
      url = new URL(link.href, page);
    } catch {
      continue;
    }
    if (!url.protocol.startsWith('http') || siteHost(url) !== siteHost(page)) continue;
    if (/contact/i.test(url.pathname) || /^contact/i.test(link.text)) {
      url.hash = '';
      contactPage = url.href;
      break;
    }
  }

  return { phone, contactPage, socials };
}
