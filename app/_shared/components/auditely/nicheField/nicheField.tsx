// app/_shared/components/auditely/nicheField/nicheField.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { CommandField } from '@/app/_shared/components/ui/commandField/commandField';
import { SearchIcon } from '@/app/_shared/components/ui/icons/icons';
import { suggestNiches } from '@/app/_shared/lib/places/nicheSuggestions';

interface NicheFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// The search bar's Business type field. Suggestions come from a fixed list in the
// browser, so they show at once and make no requests; any typed text still searches.
export function NicheField({ value, onChange, disabled }: NicheFieldProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleChange = (next: string) => {
    onChange(next);
    const results = suggestNiches(next);
    setSuggestions(results);
    setIsOpen(results.length > 0);
    setActiveIndex(-1);
  };

  const handleSelect = (niche: string) => {
    onChange(niche);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative flex min-w-0 flex-1" ref={containerRef}>
      <CommandField
        label="Business type"
        icon={<SearchIcon size={18} />}
        placeholder="Dentists, plumbers, marketing agencies…"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen && suggestions.length > 0}
        aria-controls="niche-suggestions"
        aria-autocomplete="list"
      />
      {isOpen && suggestions.length > 0 && (
        <ul
          id="niche-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
        >
          {suggestions.map((niche, i) => (
            <li
              key={niche}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(niche)}
              className={`flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                i === activeIndex
                  ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              <SearchIcon size={14} className="shrink-0 text-[var(--color-text-tertiary)]" />
              {niche}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
