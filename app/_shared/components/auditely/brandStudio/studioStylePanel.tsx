// app/_shared/components/auditely/brandStudio/studioStylePanel.tsx

// Style: the typeface the whole report is set in, how its header is drawn,
// and whether each section's title carries an icon.

'use client';

import type { ReactNode } from 'react';
import { ToggleSwitch } from '@/app/_shared/components/ui/toggleSwitch/toggleSwitch';
import { PanelIntro } from '@/app/_shared/components/auditely/brandStudio/studioPanel';
import { hasIcons, withIcons } from '@/app/_shared/components/auditely/brandStudio/studioState';
import { textOn, type BrandDesign, type FontId, type HeaderStyle } from '@/app/_shared/lib/brand/brandDesign';

const DEFAULT_ACCENT = '#6366f1';

// The PDF's built-in faces (pdfTheme.ts), and their nearest on screen
const FACES: { id: FontId; name: string; note: string; family: string }[] = [
  { id: 'sans', name: 'Sans', note: 'Clean and modern', family: 'Helvetica, Arial, sans-serif' },
  { id: 'serif', name: 'Serif', note: 'Classic, like print', family: "'Times New Roman', Times, serif" },
  { id: 'mono', name: 'Mono', note: 'Technical', family: "'Courier New', Courier, monospace" },
];

const HEADERS: { id: HeaderStyle; name: string }[] = [
  { id: 'line', name: 'Rule' },
  { id: 'band', name: 'Band' },
  { id: 'plain', name: 'Plain' },
];

const CARD =
  'rounded-xl border bg-[var(--color-surface)] text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-500)] disabled:cursor-not-allowed';
const cardState = (active: boolean) =>
  active ? 'border-[var(--color-text-primary)] shadow-[0_0_0_1px_var(--color-text-primary)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]';

/** A page's top in miniature: the header as the report will draw it */
function HeaderThumb({ style, accent }: { style: HeaderStyle; accent: string }) {
  const ink = style === 'band' ? textOn(accent) : '#1f2937';
  const lines: ReactNode = (
    <>
      <span className="block h-1.5 w-12 rounded-full" style={{ background: ink }} />
      <span className="mt-1 block h-1 w-8 rounded-full opacity-50" style={{ background: ink }} />
    </>
  );
  return (
    <span className="block h-16 overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
      {style === 'band' ? (
        <span className="block px-2.5 py-2.5" style={{ background: accent }}>
          {lines}
        </span>
      ) : (
        <span className="block px-2.5 pt-2.5">
          {lines}
          {style === 'line' && <span className="mt-2 block h-0.5 w-full" style={{ background: accent }} />}
        </span>
      )}
      <span className="mx-2.5 mt-2 block h-1 w-14 rounded-full bg-gray-200" />
    </span>
  );
}

interface StylePanelProps {
  design: BrandDesign;
  onChange: (next: BrandDesign) => void;
}

export function StudioStylePanel({ design, onChange }: StylePanelProps) {
  const accent = design.accent ?? DEFAULT_ACCENT;
  return (
    <div className="space-y-8">
      <PanelIntro title="Style">The typeface and header set the tone of every page.</PanelIntro>

      <fieldset>
        <legend className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">Typeface</legend>
        <div className="grid grid-cols-3 gap-2">
          {FACES.map((face) => (
            <button
              key={face.id}
              type="button"
              aria-pressed={design.font === face.id}
              onClick={() => onChange({ ...design, font: face.id })}
              className={`${CARD} ${cardState(design.font === face.id)} px-3 py-3`}
            >
              <span className="block text-3xl leading-none text-[var(--color-text-primary)]" style={{ fontFamily: face.family }}>
                Aa
              </span>
              <span className="mt-3 block text-sm font-medium text-[var(--color-text-primary)]">{face.name}</span>
              <span className="block text-xs text-[var(--color-text-secondary)]">{face.note}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">Header</legend>
        <div className="grid grid-cols-3 gap-2">
          {HEADERS.map((header) => (
            <button
              key={header.id}
              type="button"
              aria-pressed={design.header === header.id}
              onClick={() => onChange({ ...design, header: header.id })}
              className={`${CARD} ${cardState(design.header === header.id)} p-2`}
            >
              <HeaderThumb style={header.id} accent={accent} />
              <span className="mt-2 block px-0.5 text-sm font-medium text-[var(--color-text-primary)]">{header.name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
        <ToggleSwitch
          label="Icons beside section titles"
          helperText="Each section gets a fitting icon in your accent. Change them under Sections."
          checked={hasIcons(design)}
          onChange={(e) => onChange(withIcons(design, e.target.checked))}
        />
      </div>
    </div>
  );
}
