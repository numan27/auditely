// app/_shared/lib/utils/emailApis.ts

// Paid email-finder APIs, used when scraping a business's website finds nothing.
//   'auto': safe to run automatically after a search — only providers that can
//           check for free whether they have any email for the domain (Hunter).
//   'all':  the manual "Find email" action — Hunter, Tomba, Snov, then Apollo.
// Each provider runs only if its keys are set; the first email found wins.

import { isValidBusinessEmail } from '@/app/_shared/lib/utils/emailValidation';

export type EmailLookupMode = 'auto' | 'all';

// A key counts as configured only when it's present and not a template
// placeholder (`your_x_here`). This keeps the cascade from firing doomed
// network calls for providers the user hasn't actually set up.
function configured(...values: (string | undefined)[]): boolean {
  return values.every((v) => !!v && !/your_.*_here/i.test(v));
}

// Provider responses get the same sanity checks as scraped addresses
function validApiEmail(email: unknown): string | null {
  return typeof email === 'string' && isValidBusinessEmail(email) ? email.toLowerCase() : null;
}

async function findViaSnov(domain: string): Promise<string | null> {
  const clientId = process.env.SNOV_CLIENT_ID;
  const clientSecret = process.env.SNOV_CLIENT_SECRET;
  if (!clientId || !clientSecret || !configured(clientId, clientSecret)) return null;

  try {
    const tokenRes = await fetch('https://api.snov.io/v1/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const tokenData = await tokenRes.json();
    const accessToken: string | undefined = tokenData.access_token;
    if (!accessToken) return null;

    const auth = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };

    // Snov's domain search is an async v2 flow (the old v1
    // get-domain-emails-with-info endpoint was removed → 404). Start a task…
    const startRes = await fetch('https://api.snov.io/v2/domain-search/domain-emails/start', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ domain }),
      signal: AbortSignal.timeout(8000),
    });
    const start = await startRes.json();
    const taskHash: string | undefined = start.meta?.task_hash;
    if (!taskHash) return null;

    // …then poll for the result (typically completes within a couple seconds).
    // `status` is top-level (not under `meta`); a non-empty `data` array means
    // emails were found, while status 'completed' with empty data ends polling.
    const resultUrl = `https://api.snov.io/v2/domain-search/domain-emails/result/${taskHash}`;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await fetch(resultUrl, { headers: auth, signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      const emails: Array<{ email?: string }> = Array.isArray(data.data) ? data.data : [];
      if (emails.length > 0 || data.status === 'completed') {
        const email = emails[0]?.email;
        return validApiEmail(email);
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function findViaTomba(domain: string): Promise<string | null> {
  const key = process.env.TOMBA_API_KEY;
  const secret = process.env.TOMBA_SECRET;
  if (!key || !secret || !configured(key, secret)) return null;

  try {
    const res = await fetch(
      `https://api.tomba.io/v1/domain-search?domain=${domain}&limit=1`,
      {
        headers: { 'X-Tomba-Key': key, 'X-Tomba-Secret': secret },
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = await res.json();
    return validApiEmail(data.data?.emails?.[0]?.email);
  } catch {
    return null;
  }
}

// Hunter's email-count is free; a domain search costs one of the monthly searches
async function hunterEmailCount(domain: string, key: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.hunter.io/v2/email-count?domain=${domain}&api_key=${key}`, {
      signal: AbortSignal.timeout(8000),
    });
    const total = (await res.json()).data?.total;
    return typeof total === 'number' ? total : null;
  } catch {
    return null;
  }
}

async function findViaHunter(domain: string, mode: EmailLookupMode): Promise<string | null> {
  const key = process.env.HUNTER_API_KEY;
  if (!key || !configured(key)) return null;

  // Only spend a search when Hunter has something for this domain. If the free
  // count can't be read, the automatic pass stays frugal; a manual lookup tries.
  const count = await hunterEmailCount(domain, key);
  if (count === 0 || (count === null && mode === 'auto')) return null;

  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${key}&limit=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    return validApiEmail(data.data?.emails?.[0]?.value);
  } catch {
    return null;
  }
}

async function findViaApollo(domain: string): Promise<string | null> {
  const key = process.env.APOLLO_API_KEY;
  if (!key || !configured(key)) return null;

  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'X-Api-Key': key,
      },
      body: JSON.stringify({ q_organization_domains: domain, page: 1, per_page: 1 }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const email = data.people?.[0]?.email as string | undefined;
    // Apollo sometimes returns "email_not_unlocked@domain.com" on free tier — filter those
    if (!email || email.includes('email_not_unlocked')) return null;
    return isValidBusinessEmail(email) ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function lookupEmailViaApis(domain: string, mode: EmailLookupMode): Promise<string | null> {
  const hunter = await findViaHunter(domain, mode);
  if (hunter || mode === 'auto') return hunter;
  return (await findViaTomba(domain)) ?? (await findViaSnov(domain)) ?? (await findViaApollo(domain));
}
