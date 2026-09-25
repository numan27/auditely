// app/_shared/components/auditely/leadSearchForm/leadSearchForm.tsx

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Button } from '@/app/_shared/components/ui/button/button';

interface Suggestion {
  description: string;
  placeId: string;
}

interface LeadSearchFormProps {
  onSearch: (niche: string, location: string) => void;
  isLoading: boolean;
}

export function LeadSearchForm({ onSearch, isLoading }: LeadSearchFormProps) {
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.trim().length < 2) {
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
  }, []);

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
    if (!n || !l || isLoading) return;
    setIsOpen(false);
    onSearch(n, l);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <Input
          placeholder="Business type (e.g. dentists, plumbers)"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="flex-1 relative" ref={containerRef}>
        <Input
          placeholder="City or location (e.g. Los Angeles)"
          value={location}
          onChange={(e) => handleLocationChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          autoComplete="off"
        />
        {isOpen && suggestions.length > 0 && (
          <ul className="absolute z-50 top-full mt-1 left-0 right-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <li
                key={s.placeId}
                onMouseDown={() => handleSelect(s.description)}
                className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                  i === activeIndex
                    ? 'bg-[var(--color-primary-600)] text-white'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                {s.description}
              </li>
            ))}
            {/* Attribution required by Geoapify's free plan */}
            <li className="px-4 py-1.5 text-[11px] text-right text-[var(--color-text-tertiary)] border-t border-[var(--color-border)]">
              Powered by{' '}
              <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">
                Geoapify
              </a>
            </li>
          </ul>
        )}
      </div>

      <Button
        type="submit"
        variant="primary"
        isLoading={isLoading}
        disabled={isLoading || !niche.trim() || !location.trim()}
      >
        {isLoading ? 'Finding…' : 'Find Leads →'}
      </Button>
    </form>
  );
}
