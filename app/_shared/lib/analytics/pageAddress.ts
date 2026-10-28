// app/_shared/lib/analytics/pageAddress.ts

// What Vercel Web Analytics is told about a page: its address without anything
// private. A search's or request's id is the account's own, so it is replaced by
// its name. Report links are PDFs, never a page view; their token, which opens the
// report for anyone holding it, is replaced too should one ever be sent.
// Only the campaign tags that say where a visitor came from survive in the query.
// Client-safe: no server imports.

import type { BeforeSendEvent } from '@vercel/analytics/next';

// The path's first segment, and what the segment after it is called
const PRIVATE_SEGMENTS: Record<string, string> = { report: '[token]', search: '[id]', requests: '[id]' };

const CAMPAIGN_TAGS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref'];

/** The address with private parts replaced and only campaign tags kept; null when it isn't an address */
export function privateAddress(address: string): string | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  const [, first, second, ...rest] = url.pathname.split('/');
  const name = first ? PRIVATE_SEGMENTS[first] : undefined;
  const path = name && second ? ['', first, name, ...rest].join('/') : url.pathname;

  const kept = new URLSearchParams();
  for (const [key, value] of url.searchParams) if (CAMPAIGN_TAGS.includes(key)) kept.append(key, value);
  // Not kept.size: Safari before 17 doesn't have it
  const tags = kept.toString();
  return `${url.origin}${path}${tags ? `?${tags}` : ''}`;
}

/** Analytics' beforeSend: the event with its address cleaned, or null to send nothing */
export function withPrivateAddress(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = privateAddress(event.url);
  return url ? { ...event, url } : null;
}
