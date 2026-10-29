// app/_shared/lib/brand/brandIcons.ts

// The icons a report's section titles can carry, chosen in the Brand studio.
// Each is a few stroked paths on a 24 by 24 grid, so the same drawing goes
// into the PDF (react-pdf's Svg) and the studio (an <svg>). Client-safe.

export const ICON_IDS = [
  'gauge',
  'alert',
  'sparkle',
  'phone',
  'chat',
  'note',
  'wrench',
  'calendar',
  'star',
  'target',
  'bolt',
  'shield',
  'search',
  'chart',
  'trend',
  'heart',
  'check',
  'list',
] as const;

export type IconId = (typeof ICON_IDS)[number];

const CIRCLE = 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z';

export const ICONS: Record<IconId, { label: string; paths: string[] }> = {
  gauge: { label: 'Gauge', paths: ['M4 18a8 8 0 1 1 16 0', 'M12 18l4-6'] },
  alert: { label: 'Warning', paths: ['M12 4l9 16H3z', 'M12 10v4', 'M12 17h.01'] },
  sparkle: {
    label: 'Sparkle',
    paths: ['M12 3c.7 5 3.5 8.3 8.5 9-5 .7-7.8 3.5-8.5 9-.7-5.5-3.5-8.3-8.5-9 5-.7 7.8-4 8.5-9z'],
  },
  phone: {
    label: 'Phone',
    paths: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z'],
  },
  chat: { label: 'Message', paths: ['M4 5h16v11H10l-4 4v-4H4z'] },
  note: { label: 'Page', paths: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'] },
  wrench: { label: 'Wrench', paths: ['M14.7 6.3a4 4 0 0 0 5 5l-8.9 8.9a2.1 2.1 0 0 1-3-3z'] },
  calendar: { label: 'Calendar', paths: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v5', 'M16 3v5'] },
  star: { label: 'Star', paths: ['M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'] },
  target: { label: 'Target', paths: [CIRCLE, 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z'] },
  bolt: { label: 'Lightning', paths: ['M13 3L5 13.5h6L10 21l8-10.5h-6z'] },
  shield: { label: 'Shield', paths: ['M12 3l8 3v5.5c0 4.7-3.4 8.3-8 9.5-4.6-1.2-8-4.8-8-9.5V6z', 'M8.5 12l2.5 2.5 4.5-5'] },
  search: { label: 'Search', paths: ['M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z', 'M15.5 15.5L20 20'] },
  chart: { label: 'Bar chart', paths: ['M5 20V11', 'M12 20V4', 'M19 20v-6'] },
  trend: { label: 'Trending up', paths: ['M4 17l6-6 4 4 6-7', 'M15 8h5v5'] },
  heart: {
    label: 'Heart',
    paths: ['M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z'],
  },
  check: { label: 'Tick', paths: [CIRCLE, 'M8 12.5l2.7 2.7L16 9.8'] },
  list: { label: 'List', paths: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'] },
};

export const isIconId = (value: unknown): value is IconId => typeof value === 'string' && (ICON_IDS as readonly string[]).includes(value);
