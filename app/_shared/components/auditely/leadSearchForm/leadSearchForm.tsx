// app/_shared/components/auditely/leadSearchForm/leadSearchForm.tsx

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { CommandField } from '@/app/_shared/components/ui/commandField/commandField';
import { MapPinIcon, SearchIcon } from '@/app/_shared/components/ui/icons/icons';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';

interface Suggestion {
  description: string;
  placeId: string;
}

interface LeadSearchFormProps {
  onSearch: (niche: string, location: string) => void;
  isLoading: boolean;
}

export function LeadSearchForm({ onSearch, isLoading }: LeadSearchFormProps) {
  const demo = useDemo();
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (input: string) => {
    // The demo makes no requests, so it has no city suggestions
    if (demo || input.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/autocomplete?input=${encodeURIComponent(input)}`);
      const data = await res.json();
      const results: Suggestion[] = data.suggestions ?? [];
      setSuggestions(results);
      setIsOpen(results.length > 0);
    } catch {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [demo]);

  const handleLocationChange = (value: string) => {
    setLocation(value);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const handleSelect = (description: string) => {
    setLocation(description);
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
      handleSelect(suggestions[activeIndex].description);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = niche.trim();
    const l = location.trim();
    // In the demo the button always answers (with the notice), even with empty fields
    if (isLoading || (!demo && (!n || !l))) return;
    setIsOpen(false);
    onSearch(n, l);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-md sm:flex-row sm:items-center"
    >
      <CommandField
        label="Business type"
        icon={<SearchIcon size={18} />}
        placeholder="Dentists, plumbers, law firms…"
        value={niche}
        onChange={(e) => setNiche(e.target.value)}
        disabled={isLoading}
      />

      <span aria-hidden className="mx-4 h-px bg-[var(--color-border)] sm:mx-0 sm:h-8 sm:w-px" />

      <div className="relative flex min-w-0 flex-1" ref={containerRef}>
        <CommandField
          label="Location"
          icon={<MapPinIcon size={18} />}
          placeholder="City or area, like Austin, TX"
          value={location}
          onChange={(e) => handleLocationChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen && suggestions.length > 0}
          aria-controls="location-suggestions"
          aria-autocomplete="list"
        />
        {isOpen && suggestions.length > 0 && (
          <ul
            id="location-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.placeId}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={() => handleSelect(s.description)}
                className={`flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                  i === activeIndex
                    ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <MapPinIcon size={14} className="shrink-0 text-[var(--color-text-tertiary)]" />
                {s.description}
              </li>
            ))}
            {/* Google requires attribution when Places suggestions are shown without a map */}
            <li className="border-t border-[var(--color-border)] px-4 pb-1 pt-2 text-right text-[11px] text-[var(--color-text-tertiary)]">
              Powered by Google
            </li>
            {/* Geoapify attribution (its free plan requires it) — restore if autocomplete switches back:
            <li className="border-t border-[var(--color-border)] px-4 pb-1 pt-2 text-right text-[11px] text-[var(--color-text-tertiary)]">
              Powered by{' '}
              <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">
                Geoapify
              </a>
            </li>
            */}
          </ul>
        )}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        isLoading={isLoading}
        disabled={isLoading || (!demo && (!niche.trim() || !location.trim()))}
        className="h-12"
      >
        {isLoading ? 'Searching…' : 'Find leads'}
      </Button>
    </form>
  );
}
