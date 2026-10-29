// app/_shared/components/auditely/brandStudio/iconPicker.tsx

// The icon beside one section's title: a button showing the current icon,
// which opens a grid of the report's icons and "No icon". Escape or a click
// outside closes it; the button gets the focus back.

'use client';

import { useEffect, useRef, useState } from 'react';
import { IconGlyph } from '@/app/_shared/components/auditely/brandStudio/iconGlyph';
import { ICON_IDS, ICONS, type IconId } from '@/app/_shared/lib/brand/brandIcons';

interface IconPickerProps {
  /** The section's name, for the button's label */
  name: string;
  icon: IconId | null;
  accent: string;
  onChange: (icon: IconId | null) => void;
}

const CELL =
  'flex h-9 w-9 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary-500)]';

export function IconPicker({ name, icon, accent, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const choose = (next: IconId | null) => {
    onChange(next);
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={icon ? `${name} icon: ${ICONS[icon].label}. Change it` : `Add an icon to ${name}`}
        onClick={() => setOpen((o) => !o)}
        className={`${CELL} border-dashed border-[var(--color-border-hover)] bg-[var(--color-surface)] text-[var(--color-text-tertiary)] hover:border-[var(--color-text-tertiary)] disabled:cursor-not-allowed disabled:opacity-60 ${
          icon ? 'border-solid' : ''
        }`}
      >
        {icon ? <IconGlyph icon={icon} color={accent} /> : <span className="text-lg leading-none">+</span>}
      </button>
      {open && (
        <div
          role="group"
          aria-label={`Icons for ${name}`}
          className="absolute left-0 top-11 z-30 w-[17.5rem] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg"
        >
          <div className="grid grid-cols-6 gap-1.5">
            {ICON_IDS.map((id) => (
              <button
                key={id}
                type="button"
                title={ICONS[id].label}
                aria-label={ICONS[id].label}
                aria-pressed={id === icon}
                onClick={() => choose(id)}
                className={`${CELL} ${
                  id === icon
                    ? 'border-[var(--color-text-primary)] bg-[var(--color-bg-secondary)]'
                    : 'border-transparent hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <IconGlyph icon={id} color={accent} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => choose(null)}
            className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
          >
            No icon
          </button>
        </div>
      )}
    </div>
  );
}
