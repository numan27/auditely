// app/_shared/lib/email/outreachEmail.ts

// The outreach email as the lead sees it: the message from the "Send email"
// dialog inside DevArtVentures branding, with a snapshot of the audit and a
// "Book your free call" button for the lead who never opens the PDF. Tables
// and inline styles only: mail clients ignore most other CSS. Client-safe.

import { rankedProblems, type Problem } from '@/app/_shared/lib/audit/impact';
import { measuredSeoAndSsl, scoreTone, type AuditLike, type ScoreTone } from '@/app/_shared/lib/audit/reportData';
import { escapeHtml } from '@/app/_shared/lib/utils/html';
import type { PdfContact } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';

export interface OutreachEmail {
  /** The message as edited in the dialog */
  body: string;
  business: { name: string; website: string | null };
  audit: AuditLike;
  contact: PdfContact;
  /** The header logo: "cid:…" in the email, a data URL in the preview; null leaves it out */
  logoSrc: string | null;
}

const SITE = 'https://devartventures.com';
const TAGLINE = 'Web engineering for growing businesses';
const CALL_TITLE = 'Want help fixing these?';
const CALL_TEXT = 'We can walk you through every issue in the report on a free 15-minute call, with no obligation.';
const CALL_BUTTON = 'Book your free call';
const OPT_OUT = "Not the right person, or not interested? Just reply and we won't email again.";
const SNAPSHOT_PROBLEMS = 3;
const TILES_PER_ROW = 4;

// devartventures.com's own colours; the score colours are the PDF's
const NAVY = '#000529';
const PURPLE = '#530fff';
const TONE: Record<ScoreTone, string> = { good: '#16a34a', ok: '#d97706', poor: '#dc2626', none: '#9ca3af' };
const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';
const LABEL = `margin:0 0 10px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${PURPLE};`;

interface Tile {
  label: string;
  value: string;
  color: string;
}

/** The measured scores, named the way an owner would (the PDF explains the usual terms) */
function scoreTiles(audit: AuditLike): Tile[] {
  const { seo, ssl } = measuredSeoAndSsl(audit);
  const scores: [string, number | null | undefined][] = [
    ['Desktop speed', audit.performance_score],
    ['Phone speed', audit.mobile_score],
    ['Google search', seo],
    ['AI search', audit.geo_score],
    ['Direct answers', audit.aeo_score],
    ['Easy to reach', audit.lead_score],
  ];
  const tiles = scores.flatMap(([label, score]) =>
    typeof score === 'number' ? [{ label, value: String(score), color: TONE[scoreTone(score)] }] : []
  );
  if (typeof ssl === 'boolean') tiles.push({ label: 'Secure (https)', value: ssl ? '✓' : '✕', color: ssl ? TONE.good : TONE.poor });
  return tiles;
}

const bookingLink = (contact: PdfContact) => contact.bookingUrl ?? `mailto:${contact.email}`;
const shortUrl = (website: string) => website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const contactDetails = (contact: PdfContact) => [contact.name, contact.phone, contact.email].filter((v): v is string => !!v);

function tileRows(tiles: Tile[]): string {
  const rows: string[] = [];
  for (let i = 0; i < tiles.length; i += TILES_PER_ROW) {
    const cells = tiles.slice(i, i + TILES_PER_ROW).map(
      (tile) =>
        `<td width="25%" valign="top" style="padding:4px;"><table ${TABLE} width="100%" style="background:#f6f7fb;border-radius:10px;"><tr><td align="center" style="padding:12px 4px 10px;"><div style="font-size:24px;line-height:28px;font-weight:700;color:${tile.color};">${tile.value}</div><div style="margin-top:2px;font-size:11px;line-height:14px;color:#6b7280;">${tile.label}</div></td></tr></table></td>`
    );
    // Empty cells keep a short last row's tiles the same width
    while (cells.length < TILES_PER_ROW) cells.push('<td width="25%"></td>');
    rows.push(`<tr>${cells.join('')}</tr>`);
  }
  return rows.join('');
}

const problemRow = (problem: Problem) =>
  `<tr><td valign="top" style="padding:7px 10px 0 0;"><div style="width:7px;height:7px;border-radius:7px;background:${TONE.poor};font-size:0;line-height:0;">&nbsp;</div></td><td style="padding:0 0 12px;font-size:14px;line-height:21px;color:#4b5563;"><strong style="color:#111827;">${escapeHtml(problem.problem)}</strong>${problem.cost ? `<br>${escapeHtml(problem.cost)}` : ''}</td></tr>`;

function snapshot({ business, audit }: OutreachEmail, problems: Problem[]): string {
  const tiles = scoreTiles(audit);
  // Only a web address becomes a link
  const website = business.website && /^https?:\/\//i.test(business.website)
    ? `<a href="${escapeHtml(business.website)}" style="color:#6b7280;text-decoration:underline;">${escapeHtml(shortUrl(business.website))}</a>`
    : escapeHtml(business.website ?? '');
  const scores = tiles.length
    ? `<tr><td style="padding:14px 14px 0;"><table ${TABLE} width="100%">${tileRows(tiles)}</table></td></tr>
<tr><td style="padding:6px 18px 0;font-size:11px;line-height:16px;color:#9ca3af;">Scores are out of 100: <span style="color:${TONE.good};">80+ good</span> · <span style="color:${TONE.ok};">50–79 needs work</span> · <span style="color:${TONE.poor};">below 50 poor</span></td></tr>`
    : '';
  const costs = problems.length
    ? `<tr><td style="padding:20px 18px 0;"><p style="${LABEL}">What's costing you customers</p><table ${TABLE} width="100%">${problems.map(problemRow).join('')}</table></td></tr>`
    : '';
  return `<table ${TABLE} width="100%" style="border:1px solid #e5e7eb;border-radius:12px;">
<tr><td style="padding:18px 18px 0;"><p style="${LABEL}">Your website at a glance</p><div style="font-size:17px;line-height:24px;font-weight:700;color:#111827;">${escapeHtml(business.name)}</div><div style="font-size:13px;line-height:20px;color:#6b7280;">${website}</div></td></tr>
${scores}
${costs}
<tr><td style="padding:${problems.length ? 4 : 16}px 18px 16px;font-size:12px;line-height:18px;color:#6b7280;">The full report, with how we'd fix each issue, is attached as a PDF.</td></tr>
</table>`;
}

const paragraphs = (body: string) =>
  body
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 16px;">${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');

// The line an inbox shows beside the subject. Without it that would be the header's
// text; it is the opening of the sender's own message, so it says nothing they haven't read.
const PREHEADER_MAX = 140;
const preheader = (body: string) => body.trim().replace(/\s+/g, ' ').slice(0, PREHEADER_MAX);

export function outreachHtml(email: OutreachEmail): string {
  const { body, business, audit, contact, logoSrc } = email;
  const problems = rankedProblems(audit).slice(0, SNAPSHOT_PROBLEMS);
  const logo = logoSrc
    ? `<td width="46" valign="middle"><img src="${escapeHtml(logoSrc)}" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px;"></td>`
    : '';
  const details = contactDetails(contact)
    .map((value) =>
      value === contact.email ? `<a href="mailto:${escapeHtml(value)}" style="color:#c7cbe0;text-decoration:underline;">${escapeHtml(value)}</a>` : escapeHtml(value)
    )
    .join(' &nbsp;·&nbsp; ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(business.name)} website audit</title>
</head>
<body style="margin:0;padding:0;background:#f1f2f7;${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader(body))}</div>
<table ${TABLE} width="100%" style="background:#f1f2f7;"><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table ${TABLE} width="600" align="center"><tr><td><![endif]-->
<table ${TABLE} width="100%" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;${FONT}">
<tr><td style="padding:20px 28px;background:${NAVY};"><table ${TABLE} width="100%"><tr>
${logo}<td valign="middle" style="font-size:19px;line-height:24px;font-weight:700;color:#ffffff;${FONT}"><a href="${SITE}" style="color:#ffffff;text-decoration:none;">DevArtVentures</a></td>
<td align="right" valign="middle" style="font-size:12px;line-height:16px;color:#a7adbe;${FONT}">Website audit</td>
</tr></table></td></tr>
<tr><td style="padding:28px 28px 8px;font-size:15px;line-height:24px;color:#1f2937;${FONT}">${paragraphs(body)}</td></tr>
<tr><td style="padding:4px 28px 0;${FONT}">${snapshot(email, problems)}</td></tr>
<tr><td style="padding:20px 28px 28px;${FONT}"><table ${TABLE} width="100%" style="background:#f1edff;border-radius:12px;"><tr><td align="center" style="padding:24px 22px;">
<div style="font-size:18px;line-height:26px;font-weight:700;color:#111827;">${CALL_TITLE}</div>
<div style="margin:6px 0 18px;font-size:14px;line-height:21px;color:#4b5563;">${CALL_TEXT}</div>
<table ${TABLE} align="center"><tr><td bgcolor="${PURPLE}" style="border-radius:10px;mso-padding-alt:13px 28px;"><a href="${escapeHtml(bookingLink(contact))}" style="display:inline-block;padding:13px 28px;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;${FONT}">${CALL_BUTTON}</a></td></tr></table>
<div style="margin-top:14px;font-size:12px;line-height:18px;color:#6b7280;">Prefer email? Just reply to this message.</div>
</td></tr></table></td></tr>
<tr><td style="padding:22px 28px;background:${NAVY};font-size:12px;line-height:20px;color:#a7adbe;${FONT}">
<strong style="font-size:14px;color:#ffffff;">DevArtVentures</strong><br>${TAGLINE}<br>
<a href="${SITE}" style="color:#c7cbe0;text-decoration:underline;">devartventures.com</a><br>${details}
<div style="margin-top:12px;padding-top:12px;border-top:1px solid #1f2547;font-size:11px;line-height:17px;color:#7d84a0;">${OPT_OUT}</div>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>`;
}

/** The same email for mail clients that show no HTML */
export function outreachText({ body, business, audit, contact }: OutreachEmail): string {
  const problems = rankedProblems(audit).slice(0, SNAPSHOT_PROBLEMS);
  const scores = scoreTiles(audit).map((tile) =>
    tile.label === 'Secure (https)' ? `${tile.label}: ${tile.value === '✓' ? 'yes' : 'no'}` : `${tile.label} ${tile.value}/100`
  );
  const sections = [
    body.trim(),
    '---',
    [`${business.name} website at a glance`, scores.join(' · ')].filter(Boolean).join('\n'),
    problems.length > 0 && ["What's costing you customers:", ...problems.map((p) => `- ${[`${p.problem}.`, p.cost].filter(Boolean).join(' ')}`)].join('\n'),
    [`${CALL_TITLE} ${CALL_TEXT}`, `${CALL_BUTTON}: ${contact.bookingUrl ?? 'reply to this email'}`, 'The full report is attached as a PDF.'].join('\n'),
    [`DevArtVentures · ${SITE}`, contactDetails(contact).join(' · '), OPT_OUT].join('\n'),
  ];
  return sections.filter(Boolean).join('\n\n');
}
