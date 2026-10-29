// app/_shared/components/auditely/brandStudio/studioTabs.tsx

// The studio's tabs, one panel each. Arrow keys move between them, as in any
// tab list; a tab whose field a save refused is marked.

'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { StudioTab } from '@/app/_shared/components/auditely/brandStudio/studioState';

export const TABS: { id: StudioTab; label: string }[] = [
  { id: 'brand', label: 'Brand' },
  { id: 'colours', label: 'Colours' },
  { id: 'style', label: 'Style' },
  { id: 'sections', label: 'Sections' },
  { id: 'wording', label: 'Wording' },
];

export const tabId = (tab: StudioTab) => `studio-tab-${tab}`;
export const panelId = (tab: StudioTab) => `studio-panel-${tab}`;

interface StudioTabsProps {
  active: StudioTab;
  onChange: (tab: StudioTab) => void;
  /** The tab holding a refused field */
  flagged: StudioTab | null;
}

export function StudioTabs({ active, onChange, flagged }: StudioTabsProps) {
  const list = useRef<HTMLDivElement>(null);

  const keys = (e: KeyboardEvent) => {
    const by = { ArrowRight: 1, ArrowLeft: -1, Home: -TABS.length, End: TABS.length }[e.key];
    if (!by) return;
    e.preventDefault();
    const at = TABS.findIndex((t) => t.id === active);
    const next = TABS[Math.min(TABS.length - 1, Math.max(0, at + by))].id;
    onChange(next);
    list.current?.querySelector<HTMLButtonElement>(`#${tabId(next)}`)?.focus();
  };

  return (
    <div
      ref={list}
      role="tablist"
      aria-label="Brand studio"
      onKeyDown={keys}
      className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            id={tabId(tab.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary-500)] ${
              selected
                ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-primary)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
            {flagged === tab.id && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--color-error)]">
                <span className="sr-only"> (needs a fix)</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
