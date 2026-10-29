// app/_shared/components/auditely/brandStudio/studioSectionsPanel.tsx

// Sections: the report's parts in the order they print. Each can move up or
// down, be left out, be renamed and carry an icon. The next step's title is
// worded with its sentence and button, under Wording.

'use client';

import { IconPicker } from '@/app/_shared/components/auditely/brandStudio/iconPicker';
import { PanelIntro } from '@/app/_shared/components/auditely/brandStudio/studioPanel';
import { canHide, moveSection, updateSection } from '@/app/_shared/components/auditely/brandStudio/studioState';
import { ChevronDownIcon } from '@/app/_shared/components/ui/icons/icons';
import { SECTIONS, TITLE_MAX, type BrandDesign, type SectionDesign } from '@/app/_shared/lib/brand/brandDesign';

const DEFAULT_ACCENT = '#6366f1';

interface SectionsPanelProps {
  design: BrandDesign;
  onChange: (next: BrandDesign) => void;
  errorFor: (field: string) => string | undefined;
  /** Opens Wording, where the next step is worded */
  onWording: () => void;
}

const ARROW =
  'flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:pointer-events-none disabled:opacity-30';

function SectionRow(props: SectionsPanelProps & { section: SectionDesign; index: number }) {
  const { design, onChange, errorFor, onWording, section, index } = props;
  const { id, hidden } = section;
  const { name, title: defaultTitle } = SECTIONS[id];
  const error = errorFor(`section.${id}`);
  const lockedOn = !hidden && !canHide(design, id);

  return (
    <li
      className={`rounded-xl border bg-[var(--color-surface)] p-3 transition-opacity ${
        error ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={hidden ? 'opacity-50' : undefined}>
          <IconPicker
            name={name}
            icon={section.icon}
            accent={design.accent ?? DEFAULT_ACCENT}
            onChange={(icon) => onChange(updateSection(design, id, { icon }))}
          />
        </div>
        <span className={`min-w-0 flex-1 truncate text-sm font-medium ${hidden ? 'text-[var(--color-text-tertiary)]' : 'text-[var(--color-text-primary)]'}`}>
          {name}
          {hidden && <span className="ml-2 font-normal">Left out</span>}
        </span>
        <button
          type="button"
          className={ARROW}
          aria-label={`Move ${name} up`}
          disabled={index === 0}
          onClick={() => onChange(moveSection(design, id, -1))}
        >
          <ChevronDownIcon size={16} className="rotate-180" />
        </button>
        <button
          type="button"
          className={ARROW}
          aria-label={`Move ${name} down`}
          disabled={index === design.sections.length - 1}
          onClick={() => onChange(moveSection(design, id, 1))}
        >
          <ChevronDownIcon size={16} />
        </button>
        <label
          className="ml-1 flex cursor-pointer items-center gap-2 text-xs text-[var(--color-text-secondary)] has-[:disabled]:cursor-not-allowed"
          title={lockedOn ? 'A report keeps at least one section' : undefined}
        >
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-[var(--color-text-primary)] disabled:cursor-not-allowed"
            checked={!hidden}
            disabled={lockedOn}
            onChange={(e) => onChange(updateSection(design, id, { hidden: !e.target.checked }))}
          />
          Show
        </label>
      </div>

      {!hidden &&
        (id === 'nextStep' ? (
          <p className="mt-2 pl-11 text-xs text-[var(--color-text-secondary)]">
            Its title, sentence and button are under{' '}
            <button type="button" onClick={onWording} className="font-medium text-[var(--color-primary-600)] hover:underline">
              Wording
            </button>
            .
          </p>
        ) : (
          <div className="mt-2 pl-11">
            <input
              type="text"
              aria-label={`${name} title`}
              placeholder={defaultTitle}
              value={section.title ?? ''}
              maxLength={TITLE_MAX}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange(updateSection(design, id, { title: e.target.value === '' ? null : e.target.value }))}
              className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:bg-[var(--color-surface)] focus:outline-2 focus:outline-offset-0 focus:outline-[var(--color-primary-500)] disabled:cursor-not-allowed disabled:opacity-70"
            />
            {error && (
              <p className="mt-1 text-xs text-[var(--color-error)]" role="alert">
                {error}
              </p>
            )}
          </div>
        ))}
    </li>
  );
}

export function StudioSectionsPanel(props: SectionsPanelProps) {
  const { design, errorFor } = props;
  const error = errorFor('sections');
  return (
    <div className="space-y-6">
      <PanelIntro title="Sections">
        In the order they print. Rename one, give it an icon, or leave it out of your reports.
      </PanelIntro>
      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}
      <ol className="space-y-2">
        {design.sections.map((section, index) => (
          <SectionRow key={section.id} {...props} section={section} index={index} />
        ))}
      </ol>
    </div>
  );
}
