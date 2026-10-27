// app/_shared/lib/utils/emailApis.ts

// Paid email-finder APIs, used when scraping a business's website finds nothing.
//   'auto': safe to run automatically after a search — only providers that can
//           check for free whether they have any email for the domain first
//           (Hunter, then Snov), so a credit is spent only on a likely hit.
//   'all':  the manual "Find email" action — Hunter, Tomba, Snov, then Apollo.
// Each provider runs only if its keys are set; the first email found wins.
//
// One lookup is one business a credit is spent on: `allowPaidCall` is asked once,
// straight before the first request that spends a credit (Hunter's, Tomba's or
// Snov's domain search, Apollo's people search). The free checks (Hunter's email
// count, Snov's token and count) never ask. When it answers no, nothing more is
// requested and the lookup comes back refused.

import { isValidBusinessEmail } from '@/app/_shared/lib/utils/emailValidation';

export type EmailLookupMode = 'auto' | 'all';

export interface EmailLookupResult {
  email: string | null;
  /** true when allowPaidCall said no, so no credit was spent */
  refused: boolean;
}

// What a provider found, or that it stopped because the paid call was refused
const REFUSED = Symbol('refused');
type Found = string | null | typeof REFUSED;
type Pay = () => Promise<boolean>;

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

// General inboxes beat a random employee from a chain's list (info@ vs jane.doe@)
const GENERAL_INBOX = /^(info|contact|contactus|office|hello|frontdesk|front\.desk|reception|appointments?|admin)$/;

// Snov's email count is free; a domain search costs a credit only when it finds emails
async function snovEmailCount(domain: string, accessToken: string): Promise<number | null> {
  try {
    const res = await fetch('https://api.snov.io/v1/get-domain-emails-count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: accessToken, domain }),
      signal: AbortSignal.timeout(8000),
    });
    const result = (await res.json()).result;
    return typeof result === 'number' ? result : null;
  } catch {
    return null;
  }
}

async function findViaSnov(domain: string, mode: EmailLookupMode, pay: Pay): Promise<Found> {
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

    // Only search when Snov has something; if the count can't be read, the
    // automatic pass stays frugal and a manual lookup tries anyway.
    const count = await snovEmailCount(domain, accessToken);
    if (count === 0 || (count === null && mode === 'auto')) return null;

    if (!(await pay())) return REFUSED;
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
        const usable = emails.map((e) => validApiEmail(e.email)).filter((e): e is string => e !== null);
        return usable.find((e) => GENERAL_INBOX.test(e.split('@')[0])) ?? usable[0] ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function findViaTomba(domain: string, pay: Pay): Promise<Found> {
  const key = process.env.TOMBA_API_KEY;
  const secret = process.env.TOMBA_SECRET;
  if (!key || !secret || !configured(key, secret)) return null;
  if (!(await pay())) return REFUSED;

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

async function findViaHunter(domain: string, mode: EmailLookupMode, pay: Pay): Promise<Found> {
  const key = process.env.HUNTER_API_KEY;
  if (!key || !configured(key)) return null;

  // Only spend a search when Hunter has something for this domain. If the free
  // count can't be read, the automatic pass stays frugal; a manual lookup tries.
  const count = await hunterEmailCount(domain, key);
  if (count === 0 || (count === null && mode === 'auto')) return null;
  if (!(await pay())) return REFUSED;

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

async function findViaApollo(domain: string, pay: Pay): Promise<Found> {
  const key = process.env.APOLLO_API_KEY;
  if (!key || !configured(key)) return null;
  if (!(await pay())) return REFUSED;

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

export async function lookupEmailViaApis(
  domain: string,
  mode: EmailLookupMode,
  allowPaidCall: () => Promise<boolean> = async () => true
): Promise<EmailLookupResult> {
  // Asked once per lookup, however many providers spend a credit; a gate that
  // fails counts as no
  let allowed: Promise<boolean> | null = null;
  const pay: Pay = () => (allowed ??= allowPaidCall().catch(() => false));

  const providers: (() => Promise<Found>)[] =
    mode === 'auto'
      ? [() => findViaHunter(domain, mode, pay), () => findViaSnov(domain, mode, pay)]
      : [
          () => findViaHunter(domain, mode, pay),
          () => findViaTomba(domain, pay),
          () => findViaSnov(domain, mode, pay),
          () => findViaApollo(domain, pay),
        ];
  for (const provider of providers) {
    const found = await provider();
    if (found === REFUSED) return { email: null, refused: true };
    if (found) return { email: found, refused: false };
  }
  return { email: null, refused: false };
}
