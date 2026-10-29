// app/_shared/components/auditely/brandStudio/studioColoursPanel.tsx

// Colours: a ready-made pair to start from, then the accent (titles, links,
// the header and the next step's tint) and the button, each with its own picker.

'use client';

import { ColourField } from '@/app/_shared/components/auditely/brandStudio/colourField';
import { PanelIntro } from '@/app/_shared/components/auditely/brandStudio/studioPanel';
import { PRESETS, presetOf, type ColourPreset } from '@/app/_shared/components/auditely/brandStudio/studioState';
import { textOn, type BrandDesign } from '@/app/_shared/lib/brand/brandDesign';

// The report's own indigo (pdfTheme.ts), drawn when no accent is chosen
const DEFAULT_ACCENT = '#6366f1';

interface ColoursPanelProps {
  design: BrandDesign;
  onChange: (patch: Partial<BrandDesign>) => void;
  errorFor: (field: string) => string | undefined;
}

function Swatch({ preset, active, onPick }: { preset: ColourPreset; active: boolean; onPick: () => void }) {
  const accent = preset.accent ?? DEFAULT_ACCENT;
  const button = preset.button ?? accent;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={`group flex flex-col items-center gap-1.5 rounded-xl border p-2 pb-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-500)] disabled:cursor-not-allowed ${
        active
          ? 'border-[var(--color-text-primary)] bg-[var(--color-surface)] text-[var(--color-text-primary)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]'
      }`}
    >
      {/* The accent's band, with the button's colour where the button sits */}
      <span className="relative block h-9 w-full overflow-hidden rounded-md" style={{ background: accent }}>
        <span className="absolute bottom-1.5 right-1.5 h-2.5 w-5 rounded-full ring-1 ring-white/60" style={{ background: button }} />
      </span>
      {preset.name}
    </button>
  );
}

export function StudioColoursPanel({ design, onChange, errorFor }: ColoursPanelProps) {
  const active = presetOf(design);
  const accent = design.accent ?? DEFAULT_ACCENT;
  // A pale accent is set on white as titles and links
  const pale = design.accent !== null && textOn(design.accent) !== '#ffffff';

  return (
    <div className="space-y-8">
      <PanelIntro title="Colours">The accent colours your report&apos;s titles, links and header. The button is your call to action.</PanelIntro>

      <fieldset>
        <legend className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">Start from a palette</legend>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((preset) => (
            <Swatch
              key={preset.name}
              preset={preset}
              active={preset === active}
              onPick={() => onChange({ accent: preset.accent, button: preset.button })}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <ColourField
          label="Accent"
          value={design.accent}
          fallback={DEFAULT_ACCENT}
          defaultName="indigo"
          onChange={(value) => onChange({ accent: value })}
          error={errorFor('accent')}
          help={pale ? 'Pale colours are hard to read as titles on white. Try a deeper shade.' : 'Titles, links and the header.'}
        />
        <ColourField
          label="Button"
          value={design.button}
          fallback={accent}
          defaultName="the accent"
          onChange={(value) => onChange({ button: value })}
          error={errorFor('button')}
          help="The button’s text turns dark or light to stay readable."
        />
      </div>
    </div>
  );
}
