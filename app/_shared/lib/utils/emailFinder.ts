// app/_shared/lib/utils/emailFinder.ts

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

const GENERIC_PREFIXES = new Set([
  'info', 'contact', 'hello', 'support', 'admin', 'sales', 'office',
  'mail', 'email', 'help', 'inquiries', 'enquiries', 'service', 'team',
]);

// Domains we should never return — placeholder, CDN, tracking, infrastructure
const BLACKLISTED_DOMAINS = [
  'example.com', 'example.org', 'example.net', 'domain.com', 'mydomain.com',
  'yourdomain.com', 'yoursite.com', 'sentry.io', 'sentry-next.wixpress.com',
  'wixpress.com', 'godaddy.com', 'wix.com', 'squarespace.com',
  'cloudflare.com', 'jquery.com', 'w3.org', 'schema.org', 'localhost',
  'placeholder.com', 'gmail.com.com', 'noreply.com',
];

// Off-domain addresses are only trusted when they're a free-mail inbox (many
// small businesses use one). Anything else is usually a third party — the web
// agency in the footer, a booking platform, a widget vendor.
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com',
  'hotmail.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com',
  'protonmail.com', 'proton.me', 'gmx.com', 'zoho.com', 'comcast.net',
]);

const FAKE_LOCAL_PREFIXES = [
  'your', 'youremail', 'your.email', 'your_email', 'yourname',
  'name', 'user', 'username', 'email', 'test', 'testing', 'noreply', 'no-reply',
];

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

function isValidBusinessEmail(email: string): boolean {
  if (!email || email.length < 5 || email.length > 100) return false;
  if (!email.includes('@')) return false;

  const lower = email.toLowerCase();

  // Filter image/asset filenames that happen to contain @
  if (/\.(png|jpg|jpeg|gif|svg|webp|pdf|css|js|woff2?|ttf|ico)$/i.test(email)) return false;

  const [local, domain] = lower.split('@');
  if (!local || !domain || !domain.includes('.')) return false;

  if (BLACKLISTED_DOMAINS.includes(domain)) return false;
  if (FAKE_LOCAL_PREFIXES.includes(local)) return false;

  return true;
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

async function scrapePage(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Auditely/1.0)' },
      redirect: 'follow',
    });
    if (!res.ok) return [];
    const html = await res.text();
    return extractEmails(html);
  } catch {
    return [];
  }
}

async function scrapeWebsite(website: string, homepageHtml?: string | null): Promise<string | null> {
  const url = new URL(website);
  const origin = url.origin;
  const domain = url.hostname;

  // Homepage first (reusing HTML the audit already fetched) — if it has a good email, we're done
  const homepageEmails = homepageHtml != null ? extractEmails(homepageHtml) : await scrapePage(website);
  const homepageBest = pickBestEmail(homepageEmails, domain);
  if (homepageBest) return homepageBest;

  // Otherwise scrape secondary pages concurrently
  const pageResults = await Promise.all(
    PAGES_TO_TRY.map((p) => scrapePage(`${origin}${p}`))
  );
  const allEmails = new Set<string>(homepageEmails);
  pageResults.forEach((emails) => emails.forEach((e) => allEmails.add(e)));

  return pickBestEmail(Array.from(allEmails), domain);
}

// ─── API Fallbacks (free-tier friendly, called only if scraping fails) ──────

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

async function findViaHunter(domain: string): Promise<string | null> {
  const key = process.env.HUNTER_API_KEY;
  if (!key || !configured(key)) return null;

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

  // 2. Cascade through the (quota-limited) APIs only when explicitly enabled.
  //    Automatic/bulk callers stay scrape-only; the on-demand "Find email"
  //    action opts in. Hunter is the primary provider; the others act as
  //    backups and only run if their keys are configured. Stop at first hit.
  if (!opts.apiFallback) return null;

  return (
    (await findViaHunter(domain)) ??
    (await findViaTomba(domain)) ??
    (await findViaSnov(domain)) ??
    (await findViaApollo(domain))
  );
}
