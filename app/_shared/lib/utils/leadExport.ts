// app/_shared/lib/utils/leadExport.ts

// Turns a lead list into spreadsheet data: CSV for download, and an HTML table
// (with a TSV fallback) for pasting straight into Google Sheets or Excel.

import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

type Cell = string | number | null | undefined;

const COLUMNS: [header: string, value: (b: BusinessWithData) => Cell][] = [
  ['Name', (b) => b.name],
  ['Email', (b) => b.email],
  ['Phone', (b) => b.phone],
  ['Website', (b) => b.website],
  ['Address', (b) => b.address],
  ['Google rating', (b) => b.rating],
  ['Google reviews', (b) => b.review_count],
  ['Contact page', (b) => b.contact_page],
  ['Facebook', (b) => b.socials?.facebook],
  ['Instagram', (b) => b.socials?.instagram],
  ['LinkedIn', (b) => b.socials?.linkedin],
  ['Performance', (b) => b.audit?.performance_score],
  ['SEO', (b) => b.audit?.seo_score],
  ['Mobile', (b) => b.audit?.mobile_score],
  ['SSL', (b) => (b.audit?.ssl_valid == null ? null : b.audit.ssl_valid ? 'Yes' : 'No')],
  ['GEO', (b) => b.audit?.geo_score],
  ['AEO', (b) => b.audit?.aeo_score],
  ['Lead capture', (b) => b.audit?.lead_score],
  ['Audited on', (b) => b.audit?.created_at.slice(0, 10)],
  ['AI summary', (b) => b.ai_report?.summary],
  ['Cold email', (b) => b.ai_report?.cold_email],
];

// Spreadsheets run cells starting with = + - @ as formulas. Names and AI text
// come from the open web, so those cells get a leading ' — phone numbers like
// "+1 (202) 517-8035" are left alone.
const FORMULA_START = /^[=@\t\r]|^[+-](?![\d\s().+-]*$)/;

function cellText(value: Cell): string {
  const text = value == null ? '' : String(value);
  return FORMULA_START.test(text) ? `'${text}` : text;
}

/** Header row plus one row per business */
export function leadTable(businesses: BusinessWithData[]): string[][] {
  return [
    COLUMNS.map(([header]) => header),
    ...businesses.map((b) => COLUMNS.map(([, value]) => cellText(value(b)))),
  ];
}

/** RFC 4180 quoting; with '\t' it's the TSV that spreadsheets accept on paste */
export function toDelimited(table: string[][], delimiter: ',' | '\t'): string {
  const quote = (cell: string) =>
    /["\r\n]/.test(cell) || cell.includes(delimiter) ? `"${cell.replace(/"/g, '""')}"` : cell;
  return table.map((row) => row.map(quote).join(delimiter)).join('\r\n');
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** HTML table: pasted into Sheets it keeps multi-line cells (the cold email) intact */
export function toHtmlTable(table: string[][]): string {
  const cell = (tag: 'th' | 'td', text: string) => `<${tag}>${escapeHtml(text).replace(/\r?\n/g, '<br>')}</${tag}>`;
  const [header, ...rows] = table;
  return [
    '<table>',
    `<thead><tr>${header.map((h) => cell('th', h)).join('')}</tr></thead>`,
    `<tbody>${rows.map((row) => `<tr>${row.map((c) => cell('td', c)).join('')}</tr>`).join('')}</tbody>`,
    '</table>',
  ].join('');
}

const slug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/** e.g. auditely-dentists-washington-dc-2026-09-29.csv */
export function exportFileName(query: { niche: string; location: string } | null, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parts = query ? [slug(query.niche), slug(query.location)].filter(Boolean) : [];
  return `auditely-${parts.length ? parts.join('-') : 'leads'}-${day}.csv`;
}
