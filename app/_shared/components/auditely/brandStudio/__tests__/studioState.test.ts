// The Brand studio's draft: what's being edited, what's sent, and the edits
// the panels make to the design.

import { describe, it, expect } from 'vitest';
import {
  PRESETS,
  SUGGESTED_ICONS,
  canHide,
  draftFrom,
  hasIcons,
  moveSection,
  presetOf,
  sameDraft,
  showcaseDraft,
  studioPayload,
  tabFor,
  updateSection,
  withIcons,
} from '@/app/_shared/components/auditely/brandStudio/studioState';
import { DEFAULT_DESIGN, SECTION_IDS, parseDesignInput, visibleSections } from '@/app/_shared/lib/brand/brandDesign';
import type { ProfileFields } from '@/app/_shared/lib/brand/profileInput';

const profile: ProfileFields = {
  display_name: 'Sam Lee',
  company: null,
  website: 'https://acme.studio/',
  logo_data_url: null,
  contact_email: null,
  contact_phone: null,
  booking_url: null,
};
const order = (design = DEFAULT_DESIGN) => design.sections.map((s) => s.id);

describe('the draft', () => {
  it('holds blank fields as empty text and sends them back with the logo and the design', () => {
    const draft = draftFrom(profile, DEFAULT_DESIGN);
    expect(draft.fields.company).toBe('');
    expect(studioPayload({ ...draft, logo: 'data:image/png;base64,AA' })).toEqual({
      profile: { ...draft.fields, logo_data_url: 'data:image/png;base64,AA' },
      design: DEFAULT_DESIGN,
    });
  });

  it('knows when nothing has changed since the last save', () => {
    const saved = draftFrom(profile, DEFAULT_DESIGN);
    expect(sameDraft(saved, draftFrom(profile, DEFAULT_DESIGN))).toBe(true);
    expect(sameDraft(saved, { ...saved, design: { ...saved.design, accent: '#0e7490' } })).toBe(false);
    expect(sameDraft(saved, { ...saved, fields: { ...saved.fields, company: 'Acme' } })).toBe(false);
  });
});

describe('sections', () => {
  it('moves a section up or down, and not past either end', () => {
    expect(order(moveSection(DEFAULT_DESIGN, 'problems', -1)).slice(0, 2)).toEqual(['problems', 'scores']);
    expect(order(moveSection(DEFAULT_DESIGN, 'scores', 1)).slice(0, 2)).toEqual(['problems', 'scores']);
    expect(order(moveSection(DEFAULT_DESIGN, 'scores', -1))).toEqual(order());
    expect(order(moveSection(DEFAULT_DESIGN, 'nextStep', 1))).toEqual(order());
  });

  it('changes one section and leaves the others as they were', () => {
    const design = updateSection(DEFAULT_DESIGN, 'fixes', { title: 'Our plan', hidden: true });
    expect(design.sections.find((s) => s.id === 'fixes')).toEqual({ id: 'fixes', title: 'Our plan', hidden: true, icon: null });
    expect(design.sections.filter((s) => s.id !== 'fixes')).toEqual(DEFAULT_DESIGN.sections.filter((s) => s.id !== 'fixes'));
  });

  it('won’t hide the last section that’s still shown', () => {
    const oneLeft = SECTION_IDS.slice(1).reduce((design, id) => updateSection(design, id, { hidden: true }), DEFAULT_DESIGN);
    expect(visibleSections(oneLeft)).toEqual(['scores']);
    expect(canHide(oneLeft, 'scores')).toBe(false);
    expect(canHide(DEFAULT_DESIGN, 'scores')).toBe(true);
  });

  it('gives every section its suggested icon, keeps one already chosen, and takes them all off again', () => {
    const chosen = updateSection(DEFAULT_DESIGN, 'fixes', { icon: 'bolt' });
    const on = withIcons(chosen, true);
    expect(on.sections.map((s) => s.icon)).toEqual(SECTION_IDS.map((id) => (id === 'fixes' ? 'bolt' : SUGGESTED_ICONS[id])));
    expect(hasIcons(on)).toBe(true);
    expect(hasIcons(withIcons(on, false))).toBe(false);
    expect(hasIcons(DEFAULT_DESIGN)).toBe(false);
  });
});

describe('colour presets', () => {
  it('starts with today’s indigo, and every preset is a design the server accepts', () => {
    expect(PRESETS[0]).toMatchObject({ accent: null, button: null });
    for (const preset of PRESETS) {
      expect(parseDesignInput({ ...DEFAULT_DESIGN, accent: preset.accent, button: preset.button }).ok).toBe(true);
    }
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(PRESETS.length);
  });

  it('names the preset the design’s colours match, and none for colours of its own', () => {
    expect(presetOf(DEFAULT_DESIGN)?.name).toBe(PRESETS[0].name);
    const teal = PRESETS[1];
    expect(presetOf({ ...DEFAULT_DESIGN, accent: teal.accent, button: teal.button })).toBe(teal);
    expect(presetOf({ ...DEFAULT_DESIGN, accent: '#123456' })).toBeNull();
  });
});

describe('the showcase a locked account sees', () => {
  it('shows a finished look under the account’s own name', () => {
    const shown = showcaseDraft(draftFrom(profile, DEFAULT_DESIGN));
    expect(shown.fields.display_name).toBe('Sam Lee');
    expect(shown.design).toMatchObject({ header: 'band', accent: expect.any(String), button: expect.any(String) });
    expect(hasIcons(shown.design)).toBe(true);
    expect(parseDesignInput(shown.design).ok).toBe(true);
  });

  it('makes up a sample studio for an account with no name or company', () => {
    const blank = draftFrom({ ...profile, display_name: null }, DEFAULT_DESIGN);
    expect(showcaseDraft(blank).fields.company).toBe('Brightside Web Co.');
  });
});

describe('tabFor', () => {
  it('opens the tab that holds the field the server named', () => {
    expect(tabFor('contact_email')).toBe('brand');
    expect(tabFor('logo_data_url')).toBe('brand');
    expect(tabFor('button')).toBe('colours');
    expect(tabFor('sections')).toBe('sections');
    expect(tabFor('section.fixes')).toBe('sections');
    // The next step's title is worded with its sentence and button
    expect(tabFor('section.nextStep')).toBe('wording');
    expect(tabFor('ctaText')).toBe('wording');
    expect(tabFor('design')).toBeNull();
  });
});
