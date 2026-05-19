// app/_shared/lib/utils/emailFinder.ts

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAILTO_REGEX = /href=["']mailto:([^"'?\s]+)/gi;
const CF_EMAIL_REGEX = /data-cfemail=["']([a-f0-9]+)["']/gi;

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

// Normalize common human-readable obfuscations: "info [at] domain dot com" → "info@domain.com"
function deobfuscate(text: string): string {
  return text
    .replace(/\s*[[(]\s*at\s*[)\]]\s*/gi, '@')
    .replace(/\s+at\s+/gi, '@')
    .replace(/\s*[[(]\s*dot\s*[)\]]\s*/gi, '.')
    .replace(/\s+dot\s+/gi, '.');
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

  // Prefer emails on the same domain (most trustworthy)
  const onDomain = emails.filter((e) => {
    const d = e.split('@')[1];
    return d === cleanDomain || d.endsWith(`.${cleanDomain}`);
  });
  const candidates = onDomain.length > 0 ? onDomain : emails;

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

async function scrapeWebsite(website: string): Promise<string | null> {
  const url = new URL(website);
  const origin = url.origin;
  const domain = url.hostname;

  // Homepage first — if it has a good email, we're done
  const homepageEmails = await scrapePage(website);
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

async function findViaSnov(domain: string): Promise<string | null> {
  const clientId = process.env.SNOV_CLIENT_ID;
  const clientSecret = process.env.SNOV_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

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
    if (!tokenData.access_token) return null;

    const res = await fetch(
      `https://api.snov.io/v1/get-domain-emails-with-info?domain=${domain}&access_token=${tokenData.access_token}&type=all&limit=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    return data.emails?.[0]?.email ?? null;
  } catch {
    return null;
  }
}

async function findViaTomba(domain: string): Promise<string | null> {
  const key = process.env.TOMBA_API_KEY;
  const secret = process.env.TOMBA_SECRET;
  if (!key || !secret) return null;

  try {
    const res = await fetch(
      `https://api.tomba.io/v1/domain-search?domain=${domain}&limit=1`,
      {
        headers: { 'X-Tomba-Key': key, 'X-Tomba-Secret': secret },
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = await res.json();
    return data.data?.emails?.[0]?.email ?? null;
  } catch {
    return null;
  }
}

async function findViaHunter(domain: string): Promise<string | null> {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${key}&limit=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    return data.data?.emails?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function findViaApollo(domain: string): Promise<string | null> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return null;

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

export async function findEmail(website: string): Promise<string | null> {
  let domain: string;
  try {
    domain = new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }

  // 1. Scrape the website (free, fastest, highest trust)
  const scraped = await scrapeWebsite(website);
  if (scraped) return scraped;

  // 2. Cascade through free-tier APIs — stop at first hit to save credits
  return (
    (await findViaSnov(domain)) ??
    (await findViaTomba(domain)) ??
    (await findViaHunter(domain)) ??
    (await findViaApollo(domain))
  );
}
