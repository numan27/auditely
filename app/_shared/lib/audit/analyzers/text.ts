// app/_shared/lib/audit/analyzers/text.ts

// Normalisers shared by the structured-data and NAP analyzers.

import type { CheerioAPI } from 'cheerio';

// Business-name words that don't identify the business
const NAME_STOPWORDS = new Set(['llc', 'inc', 'pc', 'pllc', 'dds', 'dmd', 'md', 'ltd', 'co', 'the']);

const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  street: 'st', avenue: 'ave', road: 'rd', boulevard: 'blvd', drive: 'dr', suite: 'ste',
  lane: 'ln', court: 'ct', place: 'pl', highway: 'hwy', parkway: 'pkwy',
  north: 'n', south: 's', east: 'e', west: 'w',
};

const SKIPPED_ELEMENTS = new Set(['script', 'style', 'noscript', 'template', 'svg']);

export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\./g, '') // "D.D.S." → "dds"
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !NAME_STOPWORDS.has(token));
}

/** Share of the shorter name's tokens that appear in the other name (0..1). */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

/** Last 10 digits of a phone number, ignoring +1 and extensions; null if too short. */
export function phoneDigits(phone: string): string | null {
  const withoutExtension = phone
    .replace(/;ext=\d+/gi, '') // RFC 3966: tel:+1-555-123-4567;ext=22
    .replace(/,+\d+/g, '') // pause/dial suffix: 555-123-4567,,2
    .replace(/\s*(?:ext\.?|extension|x|#)\s*\d{1,6}\s*$/i, '');
  const digits = withoutExtension.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export function formatPhone(digits: string): string {
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : digits;
}

export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ADDRESS_ABBREVIATIONS[word] ?? word)
    .join(' ');
}

/** Leading street number and last 5-digit ZIP of a US address. */
export function addressParts(address: string): { streetNumber: string | null; zip: string | null } {
  const norm = normalizeAddress(address);
  const streetNumber = norm.match(/^(\d+[a-z]?)\s/)?.[1] ?? null;
  // Search for the ZIP after the street number so "12345 Ocean Blvd" isn't read as a ZIP
  const rest = streetNumber ? norm.slice(streetNumber.length) : norm;
  const zips = rest.match(/\b\d{5}\b/g);
  return { streetNumber, zip: zips ? zips[zips.length - 1] : null };
}

/** `word` must be alphanumeric (street numbers, ZIPs). */
export function containsWord(haystack: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(haystack);
}

type DomNode = { type: string; name?: string; data?: string; children?: DomNode[] };

// Iterative (explicit stack) so deeply nested markup can't overflow the call stack
function collectText(root: DomNode, out: string[]): void {
  const stack: DomNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'text' && node.data) out.push(node.data);
    if (node.name && SKIPPED_ELEMENTS.has(node.name)) continue;
    // Push children in reverse so they pop in document order
    const children = node.children ?? [];
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
}

/** Visible body text, space-separated across elements, whitespace collapsed. */
export function visibleText($: CheerioAPI): string {
  const body = $('body').get(0) as unknown as DomNode | undefined;
  if (!body) return '';
  const parts: string[] = [];
  collectText(body, parts);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
