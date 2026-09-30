// app/_shared/lib/audit/linkCheck.ts

// Tests whether a site's own links lead anywhere. Only a clear "page not found"
// (404 / 410) is broken; blocked, failing or slow links are unknown, so a
// prospect is never told that a working link is broken.

import { USER_AGENT } from '@/app/_shared/lib/audit/siteFetch';

export type LinkStatus = 'ok' | 'broken' | 'unknown';

export interface LinkResult {
  url: string;
  status: LinkStatus;
}

export const MAX_LINKS = 30;
const LINK_TIMEOUT_MS = 5_000;
const CONCURRENCY = 8;

/** An HTTP status (null = no answer) as a link result */
export function linkStatus(httpStatus: number | null): LinkStatus {
  if (httpStatus === 404 || httpStatus === 410) return 'broken';
  if (httpStatus !== null && httpStatus >= 200 && httpStatus < 400) return 'ok';
  return 'unknown';
}

async function requestStatus(url: string, method: 'HEAD' | 'GET'): Promise<number> {
  const res = await fetch(url, {
    method,
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
  });
  await res.body?.cancel().catch(() => {});
  return res.status;
}

async function checkLink(url: string): Promise<LinkResult> {
  try {
    if (linkStatus(await requestStatus(url, 'HEAD')) === 'ok') return { url, status: 'ok' };
    // Some servers refuse HEAD or answer it wrongly: only GET decides a failure
    return { url, status: linkStatus(await requestStatus(url, 'GET')) };
  } catch {
    return { url, status: 'unknown' };
  }
}

/** Checks the first 30 links, 8 at a time; results keep the input order. Never throws. */
export async function checkLinks(urls: string[]): Promise<LinkResult[]> {
  const queue = urls.slice(0, MAX_LINKS);
  const results: LinkResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const i = next++;
      results[i] = await checkLink(queue[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return results;
}
