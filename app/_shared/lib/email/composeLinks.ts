// app/_shared/lib/email/composeLinks.ts

// A lead's first email as a filled-in draft in Gmail or Outlook on the web, for
// a Free account, which sends from its own mail instead of through Auditely.
// Client-safe.

import type { OutreachDraft } from '@/app/_shared/lib/email/outreach';

export function composeLinks(to: string, draft: OutreachDraft): { gmail: string; outlook: string } {
  // Encoded whole, so an address or subject can't add parameters of its own
  const [address, subject, body] = [to, draft.subject, draft.body].map(encodeURIComponent);
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${address}&su=${subject}&body=${body}`,
    outlook: `https://outlook.office.com/mail/deeplink/compose?to=${address}&subject=${subject}&body=${body}`,
  };
}
