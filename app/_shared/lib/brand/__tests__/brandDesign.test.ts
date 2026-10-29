import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DESIGN,
  SECTION_IDS,
  normalizeHex,
  parseDesignInput,
  readDesign,
  sectionTitle,
  textOn,
  tint,
  visibleSections,
} from '@/app/_shared/lib/brand/brandDesign';
import { ICON_IDS, ICONS } from '@/app/_shared/lib/brand/brandIcons';

describe('DEFAULT_DESIGN', () => {
  it('keeps today’s report: no colours, Helvetica, the ruled header, every section in today’s order', () => {
    expect(DEFAULT_DESIGN).toMatchObject({ accent: null, button: null, font: 'sans', header: 'line', title: null, ctaText: null, ctaButton: null });
    expect(DEFAULT_DESIGN.sections.map((s) => s.id)).toEqual(['scores', 'problems', 'aiSearch', 'leads', 'summary', 'fixes', 'nextStep']);
    expect(DEFAULT_DESIGN.sections.every((s) => !s.hidden && s.title === null && s.icon === null)).toBe(true);
  });

  it('names each section the way today’s report does', () => {
    expect(SECTION_IDS.map((id) => sectionTitle(DEFAULT_DESIGN, id))).toEqual([
      'Audit Scores',
      "What's Costing You Customers",
      'AI Search Readiness',
      'Lead Capture',
      'Summary',
      "How We'd Fix It",
      'Want help fixing these?',
    ]);
  });
});

describe('readDesign', () => {
  it('reads nothing saved (before the migration, or never saved) as the default', () => {
    expect(readDesign(undefined)).toEqual(DEFAULT_DESIGN);
    expect(readDesign(null)).toEqual(DEFAULT_DESIGN);
    expect(readDesign('not json')).toEqual(DEFAULT_DESIGN);
    expect(readDesign([])).toEqual(DEFAULT_DESIGN);
  });

  it('keeps the saved fields and replaces only the ones that no longer make sense', () => {
    const design = readDesign({ accent: '#0E7490', button: 'red', font: 'serif', header: 'zigzag', title: 'Site check-up' });
    expect(design).toMatchObject({ accent: '#0e7490', button: null, font: 'serif', header: 'line', title: 'Site check-up' });
  });

  it('keeps the saved order, drops unknown or repeated sections and adds any missing ones at the end', () => {
    const design = readDesign({
      sections: [
        { id: 'summary', hidden: true, title: 'In short', icon: 'note' },
        { id: 'pricing', hidden: false },
        { id: 'scores', icon: 'not-an-icon' },
        { id: 'summary' },
      ],
    });
    expect(design.sections.map((s) => s.id)).toEqual(['summary', 'scores', 'problems', 'aiSearch', 'leads', 'fixes', 'nextStep']);
    expect(design.sections[0]).toEqual({ id: 'summary', hidden: true, title: 'In short', icon: 'note' });
    expect(design.sections[1]).toEqual({ id: 'scores', hidden: false, title: null, icon: null });
  });
});

describe('parseDesignInput', () => {
  const sections = DEFAULT_DESIGN.sections;

  it('accepts a whole design and tidies its text', () => {
    const result = parseDesignInput({
      ...DEFAULT_DESIGN,
      accent: '#1F6FEB',
      button: '#f59e0b',
      header: 'band',
      title: '  Website   health check ',
      ctaButton: 'Book a call',
      sections: sections.map((s) => (s.id === 'fixes' ? { ...s, title: 'Our plan', icon: 'wrench' } : s)),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.accent).toBe('#1f6feb');
    expect(result.design.title).toBe('Website health check');
    expect(result.design.sections.find((s) => s.id === 'fixes')).toEqual({ id: 'fixes', hidden: false, title: 'Our plan', icon: 'wrench' });
  });

  it('saves blank text as null, so the default wording comes back', () => {
    const result = parseDesignInput({ ...DEFAULT_DESIGN, title: '   ', ctaText: '' });
    expect(result).toEqual({ ok: true, design: DEFAULT_DESIGN });
  });

  it('refuses a colour that isn’t one, naming the field', () => {
    expect(parseDesignInput({ ...DEFAULT_DESIGN, accent: 'blue' })).toEqual({
      ok: false,
      field: 'accent',
      error: 'Pick a colour, or type one like #1f6feb.',
    });
  });

  it('refuses text that is too long for the report', () => {
    const result = parseDesignInput({ ...DEFAULT_DESIGN, ctaButton: 'x'.repeat(41) });
    expect(result).toMatchObject({ ok: false, field: 'ctaButton', error: 'Button text can be at most 40 characters.' });
    const title = parseDesignInput({
      ...DEFAULT_DESIGN,
      sections: sections.map((s) => (s.id === 'leads' ? { ...s, title: 'x'.repeat(61) } : s)),
    });
    expect(title).toMatchObject({ ok: false, field: 'section.leads', error: 'A section title can be at most 60 characters.' });
  });

  it('refuses a design that hides every section', () => {
    const result = parseDesignInput({ ...DEFAULT_DESIGN, sections: sections.map((s) => ({ ...s, hidden: true })) });
    expect(result).toMatchObject({ ok: false, field: 'sections', error: 'Keep at least one section on the report.' });
  });

  it('refuses something that isn’t a design at all', () => {
    expect(parseDesignInput(null)).toMatchObject({ ok: false, field: 'design' });
    expect(parseDesignInput([1, 2])).toMatchObject({ ok: false, field: 'design' });
  });
});

describe('visibleSections', () => {
  it('lists the shown sections in the design’s order', () => {
    const design = readDesign({ sections: [{ id: 'fixes' }, { id: 'scores', hidden: true }, { id: 'summary' }] });
    expect(visibleSections(design)).toEqual(['fixes', 'summary', 'problems', 'aiSearch', 'leads', 'nextStep']);
  });
});

describe('colour helpers', () => {
  it('reads a colour typed with or without #, in three or six digits', () => {
    expect(normalizeHex('#1F6FEB')).toBe('#1f6feb');
    expect(normalizeHex('1f6feb')).toBe('#1f6feb');
    expect(normalizeHex(' #abc ')).toBe('#aabbcc');
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('rgb(0,0,0)')).toBeNull();
  });

  it('tints a colour towards white', () => {
    expect(tint('#6366f1', 0)).toBe('#6366f1');
    expect(tint('#6366f1', 1)).toBe('#ffffff');
    expect(tint('#000000', 0.5)).toBe('#808080');
  });

  it('writes white on a dark colour and near-black on a light one', () => {
    expect(textOn('#6366f1')).toBe('#ffffff');
    expect(textOn('#15172a')).toBe('#ffffff');
    expect(textOn('#f9cf6e')).toBe('#111827');
    expect(textOn('#ffffff')).toBe('#111827');
  });
});

describe('ICONS', () => {
  it('draws every icon the studio offers with at least one path', () => {
    expect(ICON_IDS.length).toBeGreaterThanOrEqual(12);
    for (const id of ICON_IDS) {
      expect(ICONS[id].label).toBeTruthy();
      expect(ICONS[id].paths.length).toBeGreaterThan(0);
      for (const d of ICONS[id].paths) expect(d).toMatch(/^M/);
    }
  });
});
