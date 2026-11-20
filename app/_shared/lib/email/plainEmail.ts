// app/_shared/lib/email/plainEmail.ts

// The cold outreach email: the message alone, as a person would write it in
// their own mail app. No header, logo, score card or button: designed HTML
// from a stranger reads as marketing, and mail filters treat it that way. The
// signature is a short text line and the opt-out stays. A requested audit
// keeps the branded email (outreachEmail.ts). Client-safe.

import { escapeHtml } from '@/app/_shared/lib/utils/html';
import { shortUrl } from '@/app/_shared/lib/utils/shortUrl';
import type { OutreachBrand } from '@/app/_shared/lib/email/outreachEmail';

export interface PlainEmail {
  /** The message as edited in the dialog, sign-off included */
  body: string;
  brand: Pick<OutreachBrand, 'name' | 'website' | 'contact'>;
}

export const PLAIN_OPT_OUT = "Not the right person, or not interested? Just reply and I won't email again.";

// The brand's website, then the address to reply to, under the sign-off
function footerLines({ brand }: PlainEmail): string[] {
  const site = brand.website ? shortUrl(brand.website) : null;
  return [site, brand.contact.email].filter((v): v is string => !!v);
}

export function plainOutreachText(email: PlainEmail): string {
  return [email.body.trim(), footerLines(email).join(' · '), PLAIN_OPT_OUT].filter(Boolean).join('\n\n');
}

export function plainOutreachHtml(email: PlainEmail): string {
  const paragraphs = email.body
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const footer = footerLines(email).map(escapeHtml).join(' &middot; ');
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#222222;">
${paragraphs}${footer ? `<p style="margin:0 0 14px;color:#555555;">${footer}</p>` : ''}
<p style="margin:0;font-size:12px;line-height:18px;color:#888888;">${escapeHtml(PLAIN_OPT_OUT)}</p>
</body>
</html>`;
}
