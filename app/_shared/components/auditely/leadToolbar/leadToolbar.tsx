// app/_shared/components/auditely/leadToolbar/leadToolbar.tsx

'use client';

import { ExportMenu } from '@/app/_shared/components/auditely/exportMenu/exportMenu';
import {
  FILTER_OPTIONS,
  SORT_OPTIONS,
  type LeadFilter,
  type LeadSort,
} from '@/app/_shared/lib/utils/leadView';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

interface LeadToolbarProps {
  sort: LeadSort;
  onSortChange: (sort: LeadSort) => void;
  filters: LeadFilter[];
  counts: Record<LeadFilter, number>;
  onToggleFilter: (filter: LeadFilter) => void;
  getExportLeads: () => BusinessWithData[];
  exportFileName: string;
}

/** Filter chips, sort order and export for the results list */
export function LeadToolbar({
  sort,
  onSortChange,
  filters,
  counts,
  onToggleFilter,
  getExportLeads,
  exportFileName,
}: LeadToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter results">
        {FILTER_OPTIONS.map(({ value, label }) => {
          const active = filters.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleFilter(value)}
              className={`cursor-pointer inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-600)]/10 text-[var(--color-primary-600)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {active && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {label}
              <span className={`tabular-nums ${active ? '' : 'text-[var(--color-text-tertiary)]'}`}>
                {counts[value]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-tertiary)]">
          Sort
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as LeadSort)}
            className="cursor-pointer rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]"
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <ExportMenu getLeads={getExportLeads} fileName={exportFileName} />
      </div>
    </div>
  );
}
