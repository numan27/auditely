// app/_shared/lib/config/site.ts

// Auditely's own name and address: what a Free account's reports invite their
// reader to try, and the address search engines and links are given. The address
// is SITE_URL once the domain is set (docs/launch-setup.md). Client-safe, though
// only the server sees SITE_URL: the browser always gets the vercel.app address.

export const AUDITELY_NAME = 'Auditely';

const VERCEL_URL = 'https://auditely.vercel.app';

/** SITE_URL when it's a whole https:// address, without a path or trailing slash; else the vercel.app address */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  try {
    const url = new URL(env.SITE_URL?.trim() ?? '');
    if (url.protocol === 'https:' && url.hostname.includes('.')) return url.origin;
  } catch {
    // Not an address at all
  }
  return VERCEL_URL;
}

export const AUDITELY_URL = siteUrl();
