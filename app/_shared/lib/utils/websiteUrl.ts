// app/_shared/lib/utils/websiteUrl.ts

// Cleans up a website address typed into the "Audit a website" form.

export type WebsiteUrlResult = { ok: true; url: string; host: string } | { ok: false; error: string };

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const PRIVATE_NAMES = /(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/i;
const PUBLIC_TLD = /\.[a-z]{2,}$/i;

const INVALID = 'Enter a website address, like example.com.';

/**
 * Adds https:// when missing and drops the query and fragment. Only public
 * domain names pass: the server fetches this address, so IPs, localhost and
 * internal names are refused.
 */
export function normalizeWebsiteUrl(input: string): WebsiteUrlResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: INVALID };

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: INVALID };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Use a web address that starts with http:// or https://.' };
  }

  const host = url.hostname.toLowerCase();
  const isPublicDomain =
    !url.username && !url.password && !url.port &&
    !host.startsWith('[') && !IPV4.test(host) && !PRIVATE_NAMES.test(host) && PUBLIC_TLD.test(host);
  if (!isPublicDomain) return { ok: false, error: INVALID };

  const path = url.pathname.replace(/\/+$/, '');
  return { ok: true, url: `${url.protocol}//${host}${path}`, host: host.replace(/^www\./, '') };
}

/** Compares websites regardless of scheme, www. and a trailing slash */
export function websiteKey(website: string): string {
  try {
    const url = new URL(website);
    return `${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return website.trim().toLowerCase();
  }
}
