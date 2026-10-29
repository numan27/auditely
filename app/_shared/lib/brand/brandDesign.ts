// app/_shared/lib/brand/brandDesign.ts

// How an account's reports and emails look, set in the Brand studio: two
// colours, the typeface, the report's header, its sections (their order,
// titles, icons, and which are shown) and the words of the "next step" box.
// Saved as profiles.brand_design. Anything left blank keeps today's look, so
// DEFAULT_DESIGN draws the report exactly as it was before the studio. Checked
// the same way in the browser and on the server. Client-safe.

import { isIconId, type IconId } from '@/app/_shared/lib/brand/brandIcons';

export const SECTION_IDS = ['scores', 'problems', 'aiSearch', 'leads', 'summary', 'fixes', 'nextStep'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const FONT_IDS = ['sans', 'serif', 'mono'] as const;
export type FontId = (typeof FONT_IDS)[number];

export const HEADER_STYLES = ['line', 'band', 'plain'] as const;
export type HeaderStyle = (typeof HEADER_STYLES)[number];

export interface SectionDesign {
  id: SectionId;
  hidden: boolean;
  /** null keeps the default title */
  title: string | null;
  icon: IconId | null;
}

export interface BrandDesign {
  /** Section titles, links, the header rule; null keeps today's colours */
  accent: string | null;
  /** The "Book your free call" button; null follows the accent in the PDF and stays dark in the email */
  button: string | null;
  font: FontId;
  header: HeaderStyle;
  /** The report's title; null keeps "Website Audit Report" */
  title: string | null;
  /** The "next step" box's sentence; null keeps the offer of a free call */
  ctaText: string | null;
  ctaButton: string | null;
  /** Every section, in the order the report shows them */
  sections: SectionDesign[];
}

/** Each section's title in today's report, and its name in the studio */
export const SECTIONS: Record<SectionId, { name: string; title: string }> = {
  scores: { name: 'Scores', title: 'Audit Scores' },
  problems: { name: 'Problems', title: "What's Costing You Customers" },
  aiSearch: { name: 'AI search', title: 'AI Search Readiness' },
  leads: { name: 'Lead capture', title: 'Lead Capture' },
  summary: { name: 'Summary', title: 'Summary' },
  fixes: { name: 'Fixes', title: "How We'd Fix It" },
  nextStep: { name: 'Next step', title: 'Want help fixing these?' },
};

export const DEFAULT_TITLE = 'Website Audit Report';
export const DEFAULT_CTA_BUTTON = 'Book your free call';

export const DEFAULT_DESIGN: BrandDesign = {
  accent: null,
  button: null,
  font: 'sans',
  header: 'line',
  title: null,
  ctaText: null,
  ctaButton: null,
  sections: SECTION_IDS.map((id) => ({ id, hidden: false, title: null, icon: null })),
};

export const TITLE_MAX = 60;
export const CTA_TEXT_MAX = 240;
export const CTA_BUTTON_MAX = 40;

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A colour as #rrggbb, from one typed with or without #, in three or six digits; null when it isn't one */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.trim().match(HEX)?.[1].toLowerCase();
  if (!digits) return null;
  return `#${digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits}`;
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (values: number[]) => `#${values.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** The colour mixed with white: 0 leaves it, 1 is white */
export const tint = (hex: string, amount: number): string => toHex(channels(hex).map((c) => c + (255 - c) * amount));

const DARK_TEXT = '#111827';

// WCAG relative luminance
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** White or near-black, whichever reads better on the colour */
export function textOn(hex: string): string {
  const background = luminance(hex);
  return contrast(background, 1) >= contrast(background, luminance(DARK_TEXT)) ? '#ffffff' : DARK_TEXT;
}

/** Spaces tidied and newlines dropped; blank is null */
function tidy(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  (options as readonly unknown[]).includes(value) ? (value as T) : fallback;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** The saved order; sections it doesn't know or repeats are dropped, and missing ones join at the end */
function readSections(value: unknown): SectionDesign[] {
  const seen = new Set<SectionId>();
  const saved = (Array.isArray(value) ? value : []).flatMap((item): SectionDesign[] => {
    const section = asRecord(item);
    const id = section?.id;
    if (!section || !(SECTION_IDS as readonly unknown[]).includes(id) || seen.has(id as SectionId)) return [];
    seen.add(id as SectionId);
    return [{ id: id as SectionId, hidden: section.hidden === true, title: tidy(section.title), icon: isIconId(section.icon) ? section.icon : null }];
  });
  return [...saved, ...DEFAULT_DESIGN.sections.filter((s) => !seen.has(s.id))];
}

/** A saved design as the report uses it: whatever no longer makes sense goes back to the default */
export function readDesign(stored: unknown): BrandDesign {
  const input = asRecord(stored);
  if (!input) return DEFAULT_DESIGN;
  return {
    accent: normalizeHex(input.accent),
    button: normalizeHex(input.button),
    font: oneOf(FONT_IDS, input.font, 'sans'),
    header: oneOf(HEADER_STYLES, input.header, 'line'),
    title: tidy(input.title),
    ctaText: tidy(input.ctaText),
    ctaButton: tidy(input.ctaButton),
    sections: readSections(input.sections),
  };
}

export type DesignInputResult = { ok: true; design: BrandDesign } | { ok: false; field: string; error: string };

const COLOUR_REFUSED = 'Pick a colour, or type one like #1f6feb.';

/** The studio's design, checked before it's saved: what's wrong is named rather than quietly reset */
export function parseDesignInput(body: unknown): DesignInputResult {
  const input = asRecord(body);
  const refuse = (field: string, error: string): DesignInputResult => ({ ok: false, field, error });
  if (!input) return refuse('design', "That design couldn't be read. Reload the page and try again.");

  for (const field of ['accent', 'button'] as const) {
    const value = input[field];
    if (value !== null && value !== undefined && value !== '' && !normalizeHex(value)) return refuse(field, COLOUR_REFUSED);
  }
  const design = readDesign(input);
  const limits = [
    ['title', TITLE_MAX, 'The title'],
    ['ctaText', CTA_TEXT_MAX, 'The sentence'],
    ['ctaButton', CTA_BUTTON_MAX, 'Button text'],
  ] as const;
  for (const [field, max, label] of limits) {
    if ((design[field]?.length ?? 0) > max) return refuse(field, `${label} can be at most ${max} characters.`);
  }
  const long = design.sections.find((s) => (s.title?.length ?? 0) > TITLE_MAX);
  if (long) return refuse(`section.${long.id}`, `A section title can be at most ${TITLE_MAX} characters.`);
  if (design.sections.every((s) => s.hidden)) return refuse('sections', 'Keep at least one section on the report.');
  return { ok: true, design };
}

/** The shown sections, in the design's order */
export const visibleSections = (design: BrandDesign): SectionId[] => design.sections.filter((s) => !s.hidden).map((s) => s.id);

const sectionOf = (design: BrandDesign, id: SectionId) => design.sections.find((s) => s.id === id);

export const sectionTitle = (design: BrandDesign, id: SectionId): string => sectionOf(design, id)?.title ?? SECTIONS[id].title;
export const sectionIcon = (design: BrandDesign, id: SectionId): IconId | null => sectionOf(design, id)?.icon ?? null;
export const sectionShown = (design: BrandDesign, id: SectionId): boolean => !sectionOf(design, id)?.hidden;
