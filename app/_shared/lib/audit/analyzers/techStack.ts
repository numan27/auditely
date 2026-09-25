// app/_shared/lib/audit/analyzers/techStack.ts

// What a business's website is built with, for our own sales notes — never shown
// to the lead. Matches known signatures in the homepage HTML, its
// <meta name="generator"> tags and the response headers. Only reports what it sees.

import * as cheerio from 'cheerio';
import type { TechCategory, TechItem } from '@/app/_shared/lib/audit/types';

interface Signature {
  name: string;
  category: TechCategory;
  /** Tested against the raw HTML (URLs, markers, inline snippets) */
  html?: RegExp;
  /** Tested against each <meta name="generator"> value; group 1 = version */
  generator?: RegExp;
  /** [lower-case header name, value pattern]; group 1 = version */
  headers?: [string, RegExp][];
}

// Grouped by category, in display order
const SIGNATURES: Signature[] = [
  // Platform (CMS / site builder)
  { name: 'WordPress', category: 'platform', generator: /^WordPress\s*([\d.]+)?/i, html: /\/wp-content\/|\/wp-includes\// },
  { name: 'Wix', category: 'platform', generator: /Wix\.com/i, html: /static\.wixstatic\.com|static\.parastorage\.com/, headers: [['x-wix-request-id', /./]] },
  { name: 'Squarespace', category: 'platform', html: /static1\.squarespace\.com|images\.squarespace-cdn\.com|Static\.SQUARESPACE_CONTEXT/ },
  { name: 'Shopify', category: 'platform', html: /cdn\.shopify\.com|Shopify\.theme/, headers: [['x-shopid', /./], ['x-shopify-stage', /./]] },
  { name: 'Webflow', category: 'platform', generator: /^Webflow/i, html: /data-wf-site=/ },
  // Its own generator tag or data-ux markup — wsimg.com assets alone only mean GoDaddy hosting
  { name: 'GoDaddy Website Builder', category: 'platform', generator: /Starfield Technologies|Go ?Daddy Website Builder/i, html: /\bdata-ux="/ },
  { name: 'Duda', category: 'platform', html: /l?irp\.cdn-website\.com|multiscreensite\.com/ },
  { name: 'Weebly', category: 'platform', html: /editmysite\.com/ },
  { name: 'Joomla', category: 'platform', generator: /^Joomla/i },
  { name: 'Drupal', category: 'platform', generator: /^Drupal\s*([\d.]+)?/i, headers: [['x-generator', /^Drupal\s*([\d.]+)?/i]] },

  // Page builder
  { name: 'Elementor', category: 'pageBuilder', generator: /^Elementor/i, html: /\/plugins\/elementor\/|class="[^"]*\belementor-/ },
  { name: 'Divi', category: 'pageBuilder', html: /\/themes\/Divi\/|et_pb_section/ },
  { name: 'WPBakery', category: 'pageBuilder', generator: /WPBakery/i, html: /js_composer|\bvc_row\b/ },
  { name: 'Beaver Builder', category: 'pageBuilder', html: /fl-builder-content|\/plugins\/bb-plugin\// },

  // Framework / server language
  { name: 'Next.js', category: 'framework', html: /__NEXT_DATA__|\/_next\/static\//, headers: [['x-powered-by', /Next\.js/i]] },
  { name: 'Nuxt', category: 'framework', html: /__NUXT__|\/_nuxt\// },
  { name: 'Gatsby', category: 'framework', html: /id="___gatsby"/ },
  { name: 'PHP', category: 'framework', headers: [['x-powered-by', /PHP\/?([\d.]+)?/i]] },
  { name: 'ASP.NET', category: 'framework', headers: [['x-powered-by', /ASP\.NET/i], ['x-aspnet-version', /./]] },

  // Hosting / CDN
  { name: 'Cloudflare', category: 'hosting', headers: [['server', /cloudflare/i], ['cf-ray', /./]] },
  { name: 'Vercel', category: 'hosting', headers: [['x-vercel-id', /./], ['server', /^Vercel/i]] },
  { name: 'Netlify', category: 'hosting', headers: [['x-nf-request-id', /./], ['server', /^Netlify/i]] },
  { name: 'SiteGround', category: 'hosting', headers: [['sg-captcha', /./], ['host-header', /6b7412fb82ca5edfd0917e3957f05d89/]] },
  { name: 'WP Engine', category: 'hosting', headers: [['x-powered-by', /WP Engine/i], ['wpe-backend', /./]] },
  // GoDaddy's CDN; it also injects a wsimg.com traffic script into every site it hosts
  { name: 'GoDaddy', category: 'hosting', html: /\bwsimg\.com/ },
  { name: 'Kinsta', category: 'hosting', headers: [['x-kinsta-cache', /./]] },
  { name: 'Amazon CloudFront', category: 'hosting', headers: [['x-amz-cf-id', /./]] },
  { name: 'LiteSpeed', category: 'hosting', headers: [['server', /LiteSpeed/i]] },

  // Analytics & ads
  { name: 'Google Analytics', category: 'analytics', html: /googletagmanager\.com\/gtag\/js\?id=(?:G|UA)-|google-analytics\.com\/(?:analytics|ga)\.js|gtag\(\s*['"]config['"],\s*['"](?:G|UA)-/ },
  { name: 'Google Tag Manager', category: 'analytics', html: /googletagmanager\.com\/(?:gtm\.js|ns\.html)/ },
  { name: 'Google Ads', category: 'analytics', html: /googleadservices\.com|gtag\/js\?id=AW-|gtag\(\s*['"]config['"],\s*['"]AW-/ },
  { name: 'Meta Pixel', category: 'analytics', html: /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*['"]init/ },
  { name: 'Hotjar', category: 'analytics', html: /static\.hotjar\.com/ },
  { name: 'Microsoft Clarity', category: 'analytics', html: /clarity\.ms\/tag/ },
  { name: 'CallRail', category: 'analytics', html: /cdn\.callrail\.com/ },
  { name: 'HubSpot', category: 'analytics', html: /js\.hs-scripts\.com|js\.hsforms\.net|js\.hs-analytics\.net/ },
  { name: 'LinkedIn Insight Tag', category: 'analytics', html: /snap\.licdn\.com/ },
  { name: 'TikTok Pixel', category: 'analytics', html: /analytics\.tiktok\.com/ },

  // Booking & chat
  { name: 'Calendly', category: 'widgets', html: /calendly\.com\// },
  { name: 'Zocdoc', category: 'widgets', html: /zocdoc\.com/ },
  { name: 'NexHealth', category: 'widgets', html: /nexhealth\.com/ },
  { name: 'LocalMed', category: 'widgets', html: /localmed\.com/ },
  { name: 'Acuity Scheduling', category: 'widgets', html: /acuityscheduling\.com/ },
  { name: 'Mindbody', category: 'widgets', html: /mindbodyonline\.com|healcode\.com/ },
  { name: 'Vagaro', category: 'widgets', html: /vagaro\.com/ },
  { name: 'OpenTable', category: 'widgets', html: /opentable\.com/ },
  { name: 'Podium', category: 'widgets', html: /connect\.podium\.com/ },
  { name: 'Birdeye', category: 'widgets', html: /birdeye\.com/ },
  { name: 'Tawk.to', category: 'widgets', html: /embed\.tawk\.to/ },
  { name: 'Intercom', category: 'widgets', html: /widget\.intercom\.io|js\.intercomcdn\.com/ },
  { name: 'LiveChat', category: 'widgets', html: /cdn\.livechatinc\.com/ },
  { name: 'Drift', category: 'widgets', html: /js\.driftt\.com/ },
  { name: 'Tidio', category: 'widgets', html: /code\.tidio\.co/ },
];

function metaGenerators(html: string): string[] {
  const $ = cheerio.load(html);
  return $('meta')
    .filter((_, el) => ($(el).attr('name') ?? '').toLowerCase() === 'generator')
    .map((_, el) => $(el).attr('content') ?? '')
    .get()
    .filter(Boolean);
}

/** null = not detected; otherwise the version when a generator tag or header exposes one */
function match(sig: Signature, html: string | null, generators: string[], headers: Record<string, string>): { version?: string } | null {
  let found = false;
  let version: string | undefined;
  const consider = (m: RegExpMatchArray | null) => {
    if (!m) return;
    found = true;
    version ??= m[1];
  };

  if (sig.generator) generators.forEach((g) => consider(g.match(sig.generator!)));
  for (const [name, pattern] of sig.headers ?? []) {
    if (headers[name] !== undefined) consider(headers[name].match(pattern));
  }
  if (!found && html && sig.html?.test(html)) found = true;

  return found ? (version ? { version } : {}) : null;
}

export function detectTechStack(html: string | null, headers: Record<string, string>): TechItem[] {
  const generators = html ? metaGenerators(html) : [];
  const items: TechItem[] = [];
  for (const sig of SIGNATURES) {
    const hit = match(sig, html, generators, headers);
    if (hit) items.push({ name: sig.name, category: sig.category, ...hit });
  }
  return items;
}
