// app/_shared/lib/utils/emailValidation.ts

// Sanity checks shared by the website scraper and the email-finder APIs.

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
export const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com',
  'hotmail.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com',
  'protonmail.com', 'proton.me', 'gmx.com', 'zoho.com', 'comcast.net',
]);

const FAKE_LOCAL_PREFIXES = [
  'your', 'youremail', 'your.email', 'your_email', 'yourname',
  'name', 'user', 'username', 'email', 'test', 'testing', 'noreply', 'no-reply',
];

export function isValidBusinessEmail(email: string): boolean {
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
