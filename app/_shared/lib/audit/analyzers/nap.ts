// Name / Address / Phone consistency between the website and the Google listing.

import type { CheerioAPI } from 'cheerio';
import type { NapResult, NapStatus } from '@/app/_shared/lib/audit/types';
import type { BusinessEntity } from '@/app/_shared/lib/audit/analyzers/structuredData';
import {
  addressParts,
  containsWord,
  nameSimilarity,
  normalizeAddress,
  phoneDigits,
} from '@/app/_shared/lib/audit/analyzers/text';

const NAME_MATCH_THRESHOLD = 0.6;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export interface GoogleNap {
  name: string;
  address: string;
  phone: string | null;
}

export interface SiteNapSignals {
  entity: BusinessEntity | null;
  siteName: string | null;
  telLinks: string[];
  text: string;
}

export function extractNapSignals($: CheerioAPI, entity: BusinessEntity | null, text: string): SiteNapSignals {
  const telLinks = $('a[href^="tel:"]')
    .map((_, el) => safeDecode(($(el).attr('href') ?? '').slice(4)))
    .get();
  const ogName = $('meta[property="og:site_name"]').attr('content')?.trim() || null;
  const headTitle = $('head > title').first();
  const title = (headTitle.length > 0 ? headTitle : $('title').first()).text().trim() || null;
  return { entity, siteName: entity?.name ?? ogName ?? title, telLinks, text };
}

function compareName(google: string, siteName: string | null): NapStatus {
  if (!google.trim()) return 'n/a';
  if (!siteName) return 'missing';
  return nameSimilarity(google, siteName) >= NAME_MATCH_THRESHOLD ? 'match' : 'mismatch';
}

// Match = schema address OR visible text shows Google's street number AND ZIP as whole words
// (n/a if Google lacks either); mismatch only when a schema address exists and neither matches
function compareAddress(google: string, siteAddress: string | null, text: string): NapStatus {
  const { streetNumber, zip } = addressParts(google);
  if (!streetNumber || !zip) return 'n/a';

  const matches = (candidate: string) => {
    const norm = normalizeAddress(candidate);
    return containsWord(norm, streetNumber) && containsWord(norm, zip);
  };
  if ((siteAddress && matches(siteAddress)) || matches(text)) return 'match';
  return siteAddress ? 'mismatch' : 'missing';
}

function comparePhone(google: string | null, sitePhones: string[]): NapStatus {
  const target = google ? phoneDigits(google) : null;
  if (!target) return 'n/a';
  if (sitePhones.length === 0) return 'missing';
  return sitePhones.includes(target) ? 'match' : 'mismatch';
}

export function compareNap(google: GoogleNap, site: SiteNapSignals): NapResult {
  const candidates = [site.entity?.telephone, ...site.telLinks, ...(site.text.match(PHONE_PATTERN) ?? [])];
  const phones = [
    ...new Set(
      candidates.flatMap((p) => {
        const digits = p ? phoneDigits(p) : null;
        return digits ? [digits] : [];
      })
    ),
  ];
  const siteAddress = site.entity?.address ?? null;

  return {
    name: compareName(google.name, site.siteName),
    address: compareAddress(google.address, siteAddress, site.text),
    phone: comparePhone(google.phone, phones),
    site: { name: site.siteName, address: siteAddress, phones },
  };
}
