// app/_shared/lib/utils/contactDiscovery.ts

// Finds every way to reach a business from one homepage fetch: the email (via
// the email finder), plus the phone, contact page and social profiles.

import { fetchSite } from '@/app/_shared/lib/audit/siteFetch';
import { findEmail } from '@/app/_shared/lib/utils/emailFinder';
import { extractContactChannels, type ContactChannels } from '@/app/_shared/lib/utils/contactChannels';

export interface DiscoveredContacts extends ContactChannels {
  /** false when the homepage couldn't be loaded — channels are unknown, not absent */
  fetched: boolean;
  email: string | null;
}

export async function discoverContacts(
  website: string,
  opts: { apiFallback?: boolean } = {}
): Promise<DiscoveredContacts> {
  const site = await fetchSite(website);
  const html = site.ok ? site.html : null;
  // Reuses the homepage HTML; the finder only fetches the contact/about pages itself
  const email = await findEmail(website, { apiFallback: opts.apiFallback, homepageHtml: html });

  if (!html) return { fetched: false, email, phone: null, contactPage: null, socials: {} };
  return { fetched: true, email, ...extractContactChannels(html, site.finalUrl ?? website) };
}

/**
 * The `businesses` update for a discovery run. Email and phone are only filled
 * when empty; the channels are recorded only when the homepage loaded, so a
 * site that was down gets checked again next time.
 */
export function contactsUpdate(
  stored: { email: string | null; phone: string | null },
  found: DiscoveredContacts,
  checkedAt: string
) {
  return {
    ...(!stored.email && found.email ? { email: found.email } : {}),
    ...(found.fetched && !stored.phone && found.phone ? { phone: found.phone } : {}),
    ...(found.fetched
      ? { contact_page: found.contactPage, socials: found.socials, contacts_checked_at: checkedAt }
      : {}),
  };
}

/** The `businesses` update after the paid-API email lookup — recorded so it never runs twice. */
export function emailLookupUpdate(email: string | null, lookedUpAt: string) {
  return { ...(email ? { email } : {}), email_lookup_at: lookedUpAt };
}
