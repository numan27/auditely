// app/_shared/components/auditely/brandStudio/iconGlyph.tsx

// One of the report's section icons, drawn the way the PDF draws it: the same
// paths, stroked in the colour given.

import { ICONS, type IconId } from '@/app/_shared/lib/brand/brandIcons';

export function IconGlyph({ icon, size = 18, color = 'currentColor' }: { icon: IconId; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {ICONS[icon].paths.map((d) => (
        <path key={d} d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
