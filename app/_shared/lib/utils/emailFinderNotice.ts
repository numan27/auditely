// app/_shared/lib/utils/emailFinderNotice.ts

import type { ContactsFound } from '@/app/_shared/lib/hooks/useEmailDiscovery';

// "a", "a and b", "a, b and c"
const joinList = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** What the "Find email" action on the audit tab tells the user about one site. */
export function emailFinderNotice(name: string, found: ContactsFound | undefined): string {
  if (found?.email) return `Found ${found.email} for ${name}.`;

  const others = [
    found?.phone && 'phone number',
    found?.contact_page && 'contact form',
    found && Object.keys(found.socials ?? {}).length > 0 && 'social profiles',
  ].filter((item): item is string => Boolean(item));

  if (others.length === 0) return `No email found for ${name}, and no other contact details on its website.`;
  return `No email found for ${name}. Its ${joinList(others)} ${others.length > 1 ? 'are' : 'is'} on the card below.`;
}
