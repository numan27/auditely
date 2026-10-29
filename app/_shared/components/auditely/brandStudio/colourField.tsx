// app/_shared/components/auditely/brandStudio/colourField.tsx

// One of the design's colours: the system colour picker in a swatch, the hex
// code to type or paste, and a way back to the default. Only a complete colour
// reaches the draft; a half-typed code waits, and is named when the field is left.

'use client';

import { useId, useState } from 'react';
import { normalizeHex } from '@/app/_shared/lib/brand/brandDesign';

interface ColourFieldProps {
  label: string;
  /** The chosen colour; null is the default */
  value: string | null;
  /** The colour the default draws, shown in the swatch */
  fallback: string;
  /** What the default is called, e.g. "the accent" */
  defaultName: string;
  onChange: (value: string | null) => void;
  help?: string;
  error?: string;
}

export function ColourField({ label, value, fallback, defaultName, onChange, help, error }: ColourFieldProps) {
  const id = useId();
  // What's typed, and the colour it was typed over: a preset chosen since shows its own code
  const [typed, setTyped] = useState({ over: value, text: value ?? '' });
  const [left, setLeft] = useState(false);
  const text = typed.over === value ? typed.text : (value ?? '');
  const unfinished = left && text.trim() !== '' && !normalizeHex(text);
  const shown = error ?? (unfinished ? 'Type a colour like #1f6feb, or pick one.' : undefined);

  const type = (raw: string) => {
    const hex = raw.trim() === '' ? null : normalizeHex(raw);
    setLeft(false);
    if (raw.trim() === '' || hex) {
      setTyped({ over: hex, text: raw });
      onChange(hex);
    } else {
      setTyped({ over: value, text: raw });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => type('')}
            className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:hidden"
          >
            Use {defaultName}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border-hover)] shadow-[inset_0_0_0_2px_var(--color-surface)]"
          style={{ background: value ?? fallback }}
        >
          <input
            type="color"
            aria-label={`${label}: pick a colour`}
            value={value ?? fallback}
            onChange={(e) => type(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </span>
        <input
          id={id}
          type="text"
          inputMode="text"
          spellCheck={false}
          autoComplete="off"
          placeholder={fallback}
          value={text}
          maxLength={7}
          aria-invalid={shown ? true : undefined}
          aria-describedby={`${id}-note`}
          onChange={(e) => type(e.target.value)}
          onBlur={() => setLeft(true)}
          className={`h-10 w-full min-w-0 rounded-lg border bg-[var(--color-surface)] px-3 font-mono text-sm uppercase text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-2 focus:outline-offset-0 focus:outline-[var(--color-primary-500)] disabled:cursor-not-allowed disabled:opacity-70 ${
            shown ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'
          }`}
        />
      </div>
      <p id={`${id}-note`} className={`text-xs ${shown ? 'text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'}`} role={shown ? 'alert' : undefined}>
        {shown ?? help}
      </p>
    </div>
  );
}
