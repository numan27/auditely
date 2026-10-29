// app/_shared/components/auditely/brandStudio/studioState.ts

// The Brand studio's draft: the profile fields as typed, the logo and the
// design, what's sent to save or preview it, and the edits the panels make.
// Client-safe: nothing here reads the database or the environment.

import { DEFAULT_DESIGN, type BrandDesign, type SectionDesign, type SectionId } from '@/app/_shared/lib/brand/brandDesign';
import type { IconId } from '@/app/_shared/lib/brand/brandIcons';
import type { ProfileFields } from '@/app/_shared/lib/brand/profileInput';

export type TextField = Exclude<keyof ProfileFields, 'logo_data_url'>;

export interface StudioDraft {
  fields: Record<TextField, string>;
  logo: string | null;
  design: BrandDesign;
}

export type StudioTab = 'brand' | 'colours' | 'style' | 'sections' | 'wording';

export function draftFrom(profile: ProfileFields, design: BrandDesign): StudioDraft {
  return {
    fields: {
      display_name: profile.display_name ?? '',
      company: profile.company ?? '',
      website: profile.website ?? '',
      contact_email: profile.contact_email ?? '',
      contact_phone: profile.contact_phone ?? '',
      booking_url: profile.booking_url ?? '',
    },
    logo: profile.logo_data_url,
    design,
  };
}

/** The body PUT /api/studio and its preview take */
export const studioPayload = ({ fields, logo, design }: StudioDraft) => ({ profile: { ...fields, logo_data_url: logo }, design });

// Both are built the same way, so their keys come in the same order
export const sameDraft = (a: StudioDraft, b: StudioDraft): boolean =>
  JSON.stringify(studioPayload(a)) === JSON.stringify(studioPayload(b));

/** The section one place earlier (-1) or later (1); at either end it stays */
export function moveSection(design: BrandDesign, id: SectionId, by: -1 | 1): BrandDesign {
  const from = design.sections.findIndex((s) => s.id === id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= design.sections.length) return design;
  const sections = [...design.sections];
  [sections[from], sections[to]] = [sections[to], sections[from]];
  return { ...design, sections };
}

export const updateSection = (design: BrandDesign, id: SectionId, patch: Partial<Omit<SectionDesign, 'id'>>): BrandDesign => ({
  ...design,
  sections: design.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
});

/** A report keeps at least one section (parseDesignInput refuses one without) */
export const canHide = (design: BrandDesign, id: SectionId): boolean => design.sections.some((s) => s.id !== id && !s.hidden);

/** The icon each section gets when icons are turned on */
export const SUGGESTED_ICONS: Record<SectionId, IconId> = {
  scores: 'gauge',
  problems: 'alert',
  aiSearch: 'sparkle',
  leads: 'phone',
  summary: 'note',
  fixes: 'wrench',
  nextStep: 'calendar',
};

export const hasIcons = (design: BrandDesign): boolean => design.sections.some((s) => s.icon);

/** Every section with an icon (the suggested one where none was chosen), or none at all */
export const withIcons = (design: BrandDesign, on: boolean): BrandDesign => ({
  ...design,
  sections: design.sections.map((s) => ({ ...s, icon: on ? (s.icon ?? SUGGESTED_ICONS[s.id]) : null })),
});

export interface ColourPreset {
  name: string;
  /** null is the report's own indigo; a null button follows the accent */
  accent: string | null;
  button: string | null;
}

export const PRESETS: ColourPreset[] = [
  { name: 'Indigo', accent: null, button: null },
  { name: 'Teal', accent: '#0e7490', button: '#f59e0b' },
  { name: 'Forest', accent: '#166534', button: null },
  { name: 'Ocean', accent: '#1d4ed8', button: '#0f172a' },
  { name: 'Plum', accent: '#7e22ce', button: null },
  { name: 'Crimson', accent: '#be123c', button: '#111827' },
  { name: 'Amber', accent: '#b45309', button: '#f59e0b' },
  { name: 'Graphite', accent: '#374151', button: '#111827' },
];

export const presetOf = (design: BrandDesign): ColourPreset | null =>
  PRESETS.find((p) => p.accent === design.accent && p.button === design.button) ?? null;

// What a locked account's preview shows: a finished look, so the studio sells itself
const SHOWCASE_DESIGN: BrandDesign = withIcons({ ...DEFAULT_DESIGN, accent: '#0e7490', button: '#f59e0b', header: 'band' }, true);

/** The locked account's draft in the showcase look, signed by a sample studio when it has no name */
export function showcaseDraft(draft: StudioDraft): StudioDraft {
  const named = draft.fields.display_name.trim() || draft.fields.company.trim();
  const fields = named ? draft.fields : { ...draft.fields, display_name: 'Alex Rivera', company: 'Brightside Web Co.' };
  return { fields, logo: draft.logo, design: SHOWCASE_DESIGN };
}

const TAB_OF: Record<string, StudioTab> = {
  accent: 'colours',
  button: 'colours',
  font: 'style',
  header: 'style',
  sections: 'sections',
  title: 'wording',
  ctaText: 'wording',
  ctaButton: 'wording',
  'section.nextStep': 'wording',
};
const PROFILE_FIELDS: readonly string[] = ['display_name', 'company', 'website', 'logo_data_url', 'contact_email', 'contact_phone', 'booking_url'];

/** The tab holding the field a refused save named; null when it names none of them */
export function tabFor(field: string): StudioTab | null {
  if (PROFILE_FIELDS.includes(field)) return 'brand';
  return TAB_OF[field] ?? (field.startsWith('section.') ? 'sections' : null);
}
