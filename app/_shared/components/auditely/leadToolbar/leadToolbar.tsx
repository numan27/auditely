// app/_shared/components/auditely/leadToolbar/leadToolbar.tsx

'use client';

import type { ReactNode } from 'react';
import { EmailedFilterMenu } from '@/app/_shared/components/auditely/emailedFilterMenu/emailedFilterMenu';
import { ExportMenu } from '@/app/_shared/components/auditely/exportMenu/exportMenu';
import { FilterChip } from '@/app/_shared/components/auditely/filterChip/filterChip';
import { SortMenu } from '@/app/_shared/components/auditely/sortMenu/sortMenu';
import { FILTER_OPTIONS, type EmailedFilter, type LeadFilter, type LeadSort } from '@/app/_shared/lib/utils/leadView';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

interface LeadToolbarProps {
  sort: LeadSort;
  onSortChange: (sort: LeadSort) => void;
  filters: LeadFilter[];
  counts: Record<LeadFilter, number>;
  onToggleFilter: (filter: LeadFilter) => void;
  emailed: EmailedFilter;
  /** How many leads an emailed option would show, on top of the chips */
  countEmailed: (option: EmailedFilter) => number;
  onEmailedChange: (emailed: EmailedFilter) => void;
  getExportLeads: () => BusinessWithData[];
  exportFileName: string;
  /** Shown before the sort order ("Audit all") */
  actions?: ReactNode;
}

/** Filter chips, sort order and export for the results list */
export function LeadToolbar({
  sort,
  onSortChange,
  filters,
  counts,
  onToggleFilter,
  emailed,
  countEmailed,
  onEmailedChange,
  getExportLeads,
  exportFileName,
  actions,
}: LeadToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3 sm:justify-between sm:gap-x-3">
      {/* Beside the chips on wider screens. On phones the chips' row scrolls and would cut the menu off, so it goes below */}
      <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
        {/* One scrollable row on phones, wrapping on wider screens */}
        <div
          className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0"
          role="group"
          aria-label="Filter results"
        >
          {FILTER_OPTIONS.map(({ value, label }) => {
            const active = filters.includes(value);
            return (
              <FilterChip
                key={value}
                active={active}
                label={label}
                count={counts[value]}
                aria-pressed={active}
                onClick={() => onToggleFilter(value)}
              />
            );
          })}
        </div>
        <EmailedFilterMenu emailed={emailed} count={countEmailed} onChange={onEmailedChange} />
      </div>

      {/* On phones these carry on along the emailed menu's row instead of starting their own */}
      <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-2">
        {actions}
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-tertiary)]">
          <span aria-hidden>Sort</span>
          <SortMenu sort={sort} onSortChange={onSortChange} />
        </div>
        <ExportMenu getLeads={getExportLeads} fileName={exportFileName} />
      </div>
    </div>
  );
}
