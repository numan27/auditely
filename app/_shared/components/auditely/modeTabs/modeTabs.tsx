// app/_shared/components/auditely/modeTabs/modeTabs.tsx

'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { GaugeIcon, SearchIcon } from '@/app/_shared/components/ui/icons/icons';

export type WorkspaceMode = 'leads' | 'audit';

const TABS: { value: WorkspaceMode; label: string; icon: ReactNode }[] = [
  { value: 'leads', label: 'Find leads', icon: <SearchIcon size={15} /> },
  { value: 'audit', label: 'Audit a website', icon: <GaugeIcon size={15} /> },
];

interface ModeTabsProps {
  value: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
}

export const tabId = (mode: WorkspaceMode) => `workspace-tab-${mode}`;
export const panelId = (mode: WorkspaceMode) => `workspace-panel-${mode}`;

/** Switches the home page between searching for leads and auditing one URL */
export function ModeTabs({ value, onChange }: ModeTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs, as in any tab list
  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    onChange(TABS[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Workspace" className="inline-flex rounded-xl bg-[var(--color-bg-secondary)] p-1">
      {TABS.map((tab, i) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => { refs.current[i] = el; }}
            id={tabId(tab.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(tab.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm dark:bg-[var(--color-bg-tertiary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
