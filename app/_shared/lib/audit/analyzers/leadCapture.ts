// app/_shared/lib/audit/analyzers/leadCapture.ts

// Lead capture: can a visitor call, message or book from the homepage and the
// key pages it links to? Pure — runAudit fetches the pages and link results.
// Rubric: docs/superpowers/specs/2026-09-30-lead-capture-design.md

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { BOOKING_WORDS, sameSiteLinks, siteHost } from '@/app/_shared/lib/audit/siteLinks';
import type { LinkResult } from '@/app/_shared/lib/audit/linkCheck';
import type { Finding, LeadChecks, LeadPageKind } from '@/app/_shared/lib/audit/types';

export interface LeadPage {
  url: string;
  /** Where the page ended up after redirects; its links resolve against this */
  finalUrl?: string;
  kind: LeadPageKind;
  /** null when the page couldn't be loaded */
  html: string | null;
}

interface ParsedPage {
  kind: LeadPageKind;
  /** Where the page ended up; its links resolve against this */
  url: URL;
  /** false for a key page that redirected to another site (a booking or form tool) */
  onSite: boolean;
  html: string;
  $: CheerioAPI;
}

const PAGE_NAMES: Record<LeadPageKind, string> = {
  home: 'homepage',
  contact: 'contact page',
  booking: 'booking page',
  services: 'services page',
  about: 'about page',
};

const MIN_PHONE_DIGITS = 7;
// Fields a visitor types into (an <input> without a type is text)
const FILLABLE_TYPES = new Set(['text', 'email', 'tel', 'number', 'date', 'url']);
// Forms that collect something other than an enquiry. Not "sign up": a class or
// event sign-up is a lead form, and wrongly saying "no contact form" is worse.
const NOT_AN_ENQUIRY = /newsletter|subscri|mailchimp|mc4wp|mailpoet|klaviyo|search|login|\bcart\b/i;
// Form blocks drawn with JavaScript, so only the wrapper is in the HTML (Squarespace, Ninja Forms)
const FORM_BLOCKS = '.sqs-block-form, .nf-form-cont';
// Cloudflare hides email addresses behind its email-protection link
const EMAIL_LINKS = 'a[href^="mailto:" i], a[href*="/cdn-cgi/l/email-protection"], [data-cfemail]';
// Lazy loaders keep an embed's real address in data-lazy-src / data-src (src is about:blank)
const ADDRESS_ATTRS = ['href', 'data-lazy-src', 'data-src', 'src', 'action'];
// Only these pages hold a site's form when the homepage has none
const FORM_PAGE_KINDS: LeadPageKind[] = ['contact', 'booking'];
// Embeds that are never a form: maps, video, social, tag managers
const NOT_A_FORM_FRAME =
  /(^|\.)(google\.com|googletagmanager\.com|doubleclick\.net|youtube\.com|youtube-nocookie\.com|vimeo\.com|facebook\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com)$/i;

const FORM_TOOL_HOST =
  /(^|\.)(jotform\.(com|us)|typeform\.com|hsforms\.(net|com)|forms\.gle|formstack\.com|cognitoforms\.com|wufoo\.com|123formbuilder\.com|paperform\.co|tally\.so|formsite\.com|formspree\.io|zohopublic\.com|leadconnectorhq\.com|msgsndr\.com)$/i;
const BOOKING_TOOL_HOST =
  /(^|\.)(calendly\.com|zocdoc\.com|nexhealth\.com|localmed\.com|acuityscheduling\.com|as\.me|setmore\.com|vagaro\.com|mindbodyonline\.com|janeapp\.com|schedulicity\.com|booksy\.com|fresha\.com|housecallpro\.com|opentable\.com|resy\.com|exploretock\.com|doctible\.com|flexbook\.me)$/i;
const WHATSAPP_HOST = /^(wa\.me|api\.whatsapp\.com)$/i;

const isFormTool = (u: URL) =>
  FORM_TOOL_HOST.test(u.hostname) || (u.hostname === 'docs.google.com' && u.pathname.startsWith('/forms'));
const isBookingTool = (u: URL) =>
  BOOKING_TOOL_HOST.test(u.hostname) || (/(^|\.)squareup\.com$/i.test(u.hostname) && u.pathname.includes('/appointments'));

const displayPath = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};

/** The web addresses of the page's elements matching `selector` */
function addressesOf({ $, url }: ParsedPage, selector: string): URL[] {
  return $(selector)
    .toArray()
    .flatMap((el) => {
      const raw = ADDRESS_ATTRS.map((attr) => $(el).attr(attr)?.trim()).find(Boolean) ?? '';
      try {
        const u = new URL(raw, url);
        return u.protocol.startsWith('http') ? [u] : [];
      } catch {
        return [];
      }
    });
}

/** Every address the page links to or embeds: links, iframes, scripts, form actions */
const referencedUrls = (page: ParsedPage) => addressesOf(page, 'a[href], iframe, script[src], form[action]');

function hasTapToCall({ $ }: ParsedPage): boolean {
  return $('a[href^="tel:" i]')
    .toArray()
    .some((a) => ($(a).attr('href') ?? '').replace(/\D/g, '').length >= MIN_PHONE_DIGITS);
}

function hasEnquiryForm({ $ }: ParsedPage): boolean {
  return $('form')
    .toArray()
    .some((form) => {
      const $form = $(form);
      const naming = ['class', 'id', 'name', 'action'].map((attr) => $form.attr(attr) ?? '').join(' ');
      if ($form.attr('role') === 'search' || NOT_AN_ENQUIRY.test(naming)) return false;
      if ($form.find('input[type="password" i]').length > 0) return false;
      const buttons = $form.find('button, input[type="submit" i]').toArray();
      if (buttons.some((b) => /subscribe/i.test(`${$(b).text()} ${$(b).attr('value') ?? ''}`))) return false;
      if ($form.find('textarea').length > 0) return true;
      const fillable = $form
        .find('input, select')
        .toArray()
        .filter((field) => field.tagName === 'select' || FILLABLE_TYPES.has(($(field).attr('type') ?? 'text').toLowerCase()));
      return fillable.length >= 2;
    });
}

const hasContactForm = (page: ParsedPage) =>
  hasEnquiryForm(page) || page.$(FORM_BLOCKS).length > 0 || referencedUrls(page).some(isFormTool);

const hasEmailLink = ({ $ }: ParsedPage) => $(EMAIL_LINKS).length > 0;

/** A third-party embed we can't read (not a map, video or known tool): it may hold a form */
function hasUnknownWidget(page: ParsedPage): boolean {
  const site = siteHost(page.url);
  return addressesOf(page, 'iframe').some(
    (u) => siteHost(u) !== site && !NOT_A_FORM_FRAME.test(u.hostname) && !isBookingTool(u)
  );
}

/**
 * Why a contact form might exist that we couldn't see — a contact or booking
 * page that didn't load (and isn't a 404), or an unreadable embed on one — as
 * a finding label; null when every such place was read.
 */
function uncheckedFormPlace(pages: LeadPage[], loaded: ParsedPage[], links: LinkResult[]): string | null {
  const broken = new Set(links.filter((l) => l.status === 'broken').map((l) => l.url));
  const unread = pages.find((p) => FORM_PAGE_KINDS.includes(p.kind) && p.html === null && !broken.has(p.url));
  if (unread) return `Couldn't check the ${PAGE_NAMES[unread.kind]} for a form`;
  const widget = loaded.find((p) => FORM_PAGE_KINDS.includes(p.kind) && hasUnknownWidget(p));
  return widget ? `Couldn't read the embedded widget on the ${PAGE_NAMES[widget.kind]} — it may be a form` : null;
}

const hasWhatsApp = (page: ParsedPage) => referencedUrls(page).some((u) => WHATSAPP_HOST.test(u.hostname));

/** A booking tool's host, or the path of a booking link on the site; null when neither */
function bookingEvidence(pages: ParsedPage[]): string | null {
  for (const page of pages) {
    const tool = referencedUrls(page).find(isBookingTool);
    if (tool) return tool.hostname.replace(/^www\./, '');
  }
  for (const page of pages.filter((p) => p.onSite)) {
    const link = sameSiteLinks(page.html, page.url.href).find((l) => BOOKING_WORDS.test(`${new URL(l.url).pathname} ${l.text}`));
    if (link) return displayPath(link.url);
  }
  return null;
}

export function analyzeLeadCapture(pages: LeadPage[], links: LinkResult[]): { score: number; checks: LeadChecks } {
  const site = siteHost(new URL(pages[0].url));
  const loaded: ParsedPage[] = pages.flatMap((p) => {
    if (p.html === null) return [];
    const url = new URL(p.finalUrl ?? p.url);
    return [{ kind: p.kind, url, onSite: siteHost(url) === site, html: p.html, $: cheerio.load(p.html) }];
  });
  const findings: Finding[] = [];
  let score = 0;
  const add = (points: number, finding: Finding) => {
    score += points;
    findings.push(finding);
  };

  // 1. Tap-to-call (25)
  const callPage = loaded.find(hasTapToCall);
  if (callPage?.kind === 'home') {
    add(25, { id: 'lead.clickToCall', status: 'pass', label: 'Tap-to-call phone link on the homepage' });
  } else if (callPage) {
    add(10, {
      id: 'lead.clickToCall',
      status: 'warn',
      label: "Phone number isn't tap-to-call on the homepage",
      detail: `Only on the ${PAGE_NAMES[callPage.kind]}`,
    });
  } else {
    // Only about links: phones make plain-text numbers tappable on their own
    add(0, { id: 'lead.clickToCall', status: 'fail', label: 'No tap-to-call phone link on the pages we checked' });
  }

  // 2. Contact form (30). "No form" is only claimed when every place one could be was read;
  //    otherwise it's "couldn't check", which keeps the points, like unchecked links.
  const formPage = loaded.find(hasContactForm);
  const unchecked = formPage ? null : uncheckedFormPlace(pages, loaded, links);
  if (formPage) {
    add(30, { id: 'lead.form', status: 'pass', label: `Contact form on the ${PAGE_NAMES[formPage.kind]}` });
  } else if (unchecked) {
    add(30, { id: 'lead.form', status: 'warn', label: unchecked });
  } else if (loaded.some(hasEmailLink)) {
    add(10, { id: 'lead.form', status: 'warn', label: 'Only an email link — no contact form found' });
  } else {
    add(0, { id: 'lead.form', status: 'fail', label: 'No contact form or email link found on the pages we checked' });
  }

  // 3. Online booking (15) — a warning at worst: not every business books online
  const booking = bookingEvidence(loaded);
  if (booking) {
    add(15, { id: 'lead.booking', status: 'pass', label: 'Online booking or appointment request', detail: booking });
  } else {
    add(0, { id: 'lead.booking', status: 'warn', label: 'No online booking — visitors can only call or email' });
  }

  // 4. Contact page (10): linked from the homepage, or a form right on it
  if (pages.some((p) => p.kind === 'contact')) {
    add(10, { id: 'lead.contactPage', status: 'pass', label: 'Contact page linked from the homepage' });
  } else if (formPage?.kind === 'home') {
    add(10, { id: 'lead.contactPage', status: 'pass', label: 'Contact form right on the homepage' });
  } else {
    add(0, { id: 'lead.contactPage', status: 'fail', label: 'No contact page linked from the homepage' });
  }

  // 5. Broken links (20). When nothing could be checked the site keeps the points.
  const broken = links.filter((l) => l.status === 'broken').map((l) => l.url);
  const checked = links.filter((l) => l.status !== 'unknown').length;
  if (broken.length > 0) {
    add(0, {
      id: 'lead.brokenLinks',
      status: 'fail',
      label: `${broken.length} broken link${broken.length === 1 ? '' : 's'} — visitors land on a "page not found"`,
      detail: broken.slice(0, 3).map(displayPath).join(', '),
    });
  } else if (checked > 0) {
    add(20, { id: 'lead.brokenLinks', status: 'pass', label: `No broken links (${checked} checked)` });
  } else {
    add(20, { id: 'lead.brokenLinks', status: 'warn', label: "Couldn't check the site's links" });
  }

  // 6. WhatsApp: mentioned only when found (rare for US businesses)
  if (loaded.some(hasWhatsApp)) findings.push({ id: 'lead.whatsapp', status: 'pass', label: 'WhatsApp chat link' });

  return {
    score,
    checks: {
      findings,
      pages: pages.map((p) => ({ url: p.url, kind: p.kind, ok: p.html !== null })),
      links: { checked, broken },
    },
  };
}
